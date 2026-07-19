import supabase from './db.js';
import { fetchProblemsByRating } from './codeforces.js';

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
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('status')
      .eq('id', player1Id)
      .single();

    if (userError) {
      throw new Error(`Failed to fetch user status: ${userError.message}`);
    }

    if (user && user.status === 'busy') {
      throw new Error('Player is currently busy and cannot create a new match.');
    }

    // b. Call fetchProblemsByRating(minRating, maxRating, 5) to fetch the problem set
    const problemSet = await fetchProblemsByRating(minRating, maxRating, 5);

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
        .in('status', ['waiting', 'active'])
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
        problems: problemSet,
        player_1_id: player1Id,
        status: 'waiting',
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
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('status')
      .eq('id', player2Id)
      .single();

    if (userError) {
      throw new Error(`Failed to fetch player status: ${userError.message}`);
    }

    if (user && user.status === 'busy') {
      throw new Error('Player is currently busy and cannot join a match.');
    }

    // b. Look up the match in the 'matches' table
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('room_code', roomCode)
      .eq('status', 'waiting')
      .maybeSingle();

    if (matchError) {
      throw new Error(`Database error while searching for match: ${matchError.message}`);
    }

    if (!match) {
      throw new Error('Match not found or already started');
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
        status: 'active',
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
    });
}


