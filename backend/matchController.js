import supabase from './db.js';
import { fetchProblemsByRating } from './codeforces.js';

/**
 * Ensures a user profile exists in Supabase.
 * If not, throws an error.
 */
async function ensureUserProfile(userId) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, status, rating, handle')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to query user profile: ${error.message}`);
  }

  if (!user) {
    throw new Error(`Profile not found for user ${userId}. Please complete onboarding.`);
  }

  if (!user.handle) {
    throw new Error(`User ${userId} has not set a Codeforces handle. Please complete onboarding.`);
  }

  return user;
}

/**
 * Creates a new lockout match.
 * 
 * @param {string} player1Id - The ID of the match creator (challenger).
 * @param {number} minRating - Minimum Codeforces problem rating.
 * @param {number} maxRating - Maximum Codeforces problem rating.
 * @returns {Promise<Object>} The created match object dataset.
 */
export async function createMatch(player1Id, minRating, maxRating) {
  try {
    // a. Check if the player is already flagged as busy in the system memory/state (per strict concurrency rule)
    const user = await ensureUserProfile(player1Id);

    if (user.status === 'busy') {
      throw new Error('Player is currently busy and cannot create a new match.');
    }

    // b. Codeforces fetch deferred to startMatch
    
    // c. Generate a unique 4-digit numeric room code string (e.g., '4022')
    let roomCode = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      roomCode = Math.floor(1000 + Math.random() * 9000).toString();
      const { data: existingMatch, error: matchCheckError } = await supabase
        .from('matches')
        .select('id')
        .eq('room_code', roomCode)
        .in('status', ['waiting', 'active', 'PENDING'])
        .maybeSingle();

      if (!matchCheckError && !existingMatch) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new Error('Failed to generate a unique room code. Please try again.');
    }

    // d. Insert a new row into the 'matches' table
    const { data: newMatch, error: insertError } = await supabase
      .from('matches')
      .insert({
        room_code: roomCode,
        problems: [],
        min_rating: minRating,
        max_rating: maxRating,
        player_1_id: player1Id,
        status: 'waiting',
        mode: 'Mode A',
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create match row: ${insertError.message}`);
    }

    // e. Set the creator's status flag to 'busy'
    const { error: updateError } = await supabase
      .from('users')
      .update({ status: 'busy' })
      .eq('id', player1Id);

    if (updateError) {
      // Rollback match creation if user update fails to preserve status consistency
      await supabase.from('matches').delete().eq('id', newMatch.id);
      throw new Error(`Failed to update player status to busy: ${updateError.message}`);
    }

    // f. Return the created match object dataset
    return newMatch;
  } catch (error) {
    console.error('Error in createMatch:', error.message);
    throw error;
  }
}

/**
 * Joins an existing lockout match.
 * 
 * @param {string} player2Id - The ID of the joining player.
 * @param {string} roomCode - The 4-digit room code.
 * @returns {Promise<Object>} The updated match record.
 */
export async function joinMatch(player2Id, roomCode) {
  try {
    // a. Check if Player 2 is already marked as 'busy' in the 'users' table
    const user = await ensureUserProfile(player2Id);

    if (user.status === 'busy') {
      throw new Error('Player is currently busy and cannot join a match.');
    }

    // b. Look up the match in the 'matches' table
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('room_code', roomCode)
      .in('status', ['waiting', 'PENDING'])
      .maybeSingle();

    if (matchError) {
      throw new Error(`Database error while searching for match: ${matchError.message}`);
    }

    if (!match) {
      throw new Error('Match not found or already started');
    }
    
    if (match.player_1_id && match.player_2_id) {
      const err = new Error('Arena is full');
      err.status = 409;
      throw err;
    }

    // c. Verify that Player 2's ID is NOT the same as 'player_1_id'
    if (match.player_1_id === player2Id) {
      throw new Error('You cannot duel yourself.');
    }

    // d. Update the 'matches' row
    const { data: updatedMatch, error: updateMatchError } = await supabase
      .from('matches')
      .update({
        player_2_id: player2Id,
        status: 'PENDING'
      })
      .eq('id', match.id)
      .select()
      .single();

    if (updateMatchError) {
      throw new Error(`Failed to join match: ${updateMatchError.message}`);
    }

    // e. Set Player 2's status flag to 'busy' in the 'users' table
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ status: 'busy' })
      .eq('id', player2Id);

    if (updateUserError) {
      // Rollback match update to preserve status consistency
      await supabase
        .from('matches')
        .update({
          player_2_id: null,
          status: 'waiting',
        })
        .eq('id', match.id);
      throw new Error(`Failed to update player status to busy: ${updateUserError.message}`);
    }

    // Trigger Supabase real-time broadcast channel payload transmission
    broadcastMatchUpdate(updatedMatch.id, updatedMatch);

    // f. Return the updated match record
    return updatedMatch;
  } catch (error) {
    console.error('Error in joinMatch:', error.message);
    throw error;
  }
}

/**
 * Starts a pending match (Host only).
 */
export async function startMatch(matchId, hostId) {
  try {
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();
      
    if (matchError || !match) {
      throw new Error('Match not found');
    }
    
    if (match.player_1_id !== hostId) {
      throw new Error('Only the room host can start the match');
    }
    
    if (match.status !== 'PENDING') {
      throw new Error('Match is not in PENDING state');
    }
    
    // Fetch problems from Codeforces
    const problemSet = await fetchProblemsByRating(match.min_rating || 1000, match.max_rating || 3000, 5);
    
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    const { data: updatedMatch, error: updateError } = await supabase
      .from('matches')
      .update({
        status: 'active',
        problems: problemSet,
        expires_at: expiresAt
      })
      .eq('id', matchId)
      .select()
      .single();
      
    if (updateError) {
      throw new Error(`Failed to start match: ${updateError.message}`);
    }
    
    broadcastMatchUpdate(updatedMatch.id, updatedMatch);
    return updatedMatch;
  } catch (error) {
    console.error('Error in startMatch:', error.message);
    throw error;
  }
}

/**
 * Broadcasts match updates over a Supabase Realtime channel.
 * 
 * @param {string} matchId 
 * @param {Object} matchData 
 */
export function broadcastMatchUpdate(matchId, matchData) {
  console.log(`[BROADCAST] Sending real-time match state update for room ${matchId}`);
  
  // Directly send the broadcast event without stacking fresh nested subscription hooks
  supabase.channel(`match:${matchId}`)
    .send({
      type: 'broadcast',
      event: 'match_update',
      payload: matchData,
    })
    .catch(err => console.error('[BROADCAST ERROR] Failed to send update:', err));
}

/**
 * Leaves or forfeits a match.
 * Resets the player status in the database and cleans up match state.
 * 
 * @param {string} playerId - The ID of the player leaving.
 * @param {string} matchId - The ID of the match.
 * @returns {Promise<Object>} The updated match dataset or cleanup confirmation.
 */
export async function leaveMatch(playerId, matchId) {
  try {
    // 1. Fetch the match data safely
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();

    if (matchError) {
      throw new Error(`Database error looking up match: ${matchError.message}`);
    }

    if (!match) {
      // If no match found, just make sure the player is set to 'VERIFIED'
      await supabase
        .from('users')
        .update({ status: 'VERIFIED' })
        .eq('id', playerId);
      return { status: 'cleaned', message: 'Player status reset to verified.' };
    }

    // 2. Determine leaving behavior based on match status
    if (match.status === 'waiting') {
      // Match was waiting for a second player. Creator is leaving.
      // Cancel the match and free player 1.
      await supabase
        .from('matches')
        .update({ status: 'finished' })
        .eq('id', matchId);

      await supabase
        .from('users')
        .update({ status: 'VERIFIED' })
        .eq('id', match.player_1_id);

      return { status: 'finished', message: 'Match cancelled, player verified.' };
    }

    if (match.status === 'active') {
      // Match was active. Player explicitly left or dropped.
      // Phase 6: Write disconnected_at directly to the DB instead of a memory leak timeout
      console.log(`[LIFECYCLE] Player ${playerId} left active match. Marking disconnected_at for room ${matchId}...`);
      
      const disconnectedAt = new Date().toISOString();

      // Free the leaving player immediately so they can return to the dashboard
      await supabase
        .from('users')
        .update({ status: 'VERIFIED' })
        .eq('id', playerId);

      // Flag the match with the timestamp
      await supabase
        .from('matches')
        .update({
          disconnected_at: disconnectedAt
        })
        .eq('id', matchId);

      return { status: 'grace_period', message: 'Grace timer logged in database.' };
    }

    // If match was already finished, just free the leaving player
    await supabase
      .from('users')
      .update({ status: 'VERIFIED' })
      .eq('id', playerId);

    return match;
  } catch (error) {
    console.error('Error in leaveMatch:', error.message);
    throw error;
  }
}


