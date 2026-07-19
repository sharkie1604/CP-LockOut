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
