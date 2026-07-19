import axios from 'axios';
import supabase from './db.js';
import { calculateNewRatings } from './elo.js';

// Calculates and updates Elo ratings for completed match players
async function triggerEloCalculation(matchId) {
  try {
    console.log(`[ELO] Triggering Elo calculation for match ${matchId}`);
    
    // 1. Fetch the completed match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      throw new Error(`Match not found for Elo calculation: ${matchError?.message}`);
    }

    const { player_1_id, player_2_id, player_1_score, player_2_score } = match;

    if (!player_1_id || !player_2_id) {
      throw new Error('Match must have two players for rating calculation.');
    }

    // 2. Fetch current user ratings
    const { data: players, error: playersError } = await supabase
      .from('users')
      .select('id, rating')
      .in('id', [player_1_id, player_2_id]);

    if (playersError || !players || players.length < 2) {
      throw new Error(`Could not fetch rating for both players: ${playersError?.message}`);
    }

    const player1 = players.find(p => p.id === player_1_id);
    const player2 = players.find(p => p.id === player_2_id);

    const r1 = player1.rating || 1000;
    const r2 = player2.rating || 1000;

    // 3. Determine outcome (1 if player 1 wins, 0 if player 2 wins, 0.5 for tie)
    let outcome = 0.5;
    let winnerId = null;
    
    if (player_1_score > player_2_score) {
      outcome = 1;
      winnerId = player_1_id;
    } else if (player_2_score > player_1_score) {
      outcome = 0;
      winnerId = player_2_id;
    }

    // Update winner_id in the match row if it isn't set yet
    if (winnerId) {
      await supabase
        .from('matches')
        .update({ winner_id: winnerId })
        .eq('id', matchId);
    }

    // 4. Calculate new ratings
    const { newPlayer1Rating, newPlayer2Rating } = calculateNewRatings(r1, r2, outcome);

    // 5. Update user rating points in the database
    const { error: update1Error } = await supabase
      .from('users')
      .update({ rating: newPlayer1Rating })
      .eq('id', player_1_id);

    const { error: update2Error } = await supabase
      .from('users')
      .update({ rating: newPlayer2Rating })
      .eq('id', player_2_id);

    if (update1Error || update2Error) {
      throw new Error(`Failed to update ratings: ${update1Error?.message || update2Error?.message}`);
    }

    console.log(`[ELO] Ratings updated successfully. Player 1: ${r1} -> ${newPlayer1Rating}. Player 2: ${r2} -> ${newPlayer2Rating}`);
  } catch (error) {
    console.error(`[ELO ERROR] Error calculating ratings for match ${matchId}:`, error.message);
  }
}

/**
 * Helper to release players from a match back to 'free' status.
 */
async function freePlayers(player1Id, player2Id) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ status: 'free' })
      .in('id', [player1Id, player2Id]);

    if (error) {
      console.error(`Failed to free players ${player1Id} and ${player2Id}:`, error.message);
    } else {
      console.log(`Players ${player1Id} and ${player2Id} are now free.`);
    }
  } catch (err) {
    console.error('Error freeing players:', err.message);
  }
}

/**
 * Fetches latest submissions for a Codeforces handle.
 * Pauses for 2000ms to respect rate-limiting.
 */
async function fetchUserSubmissions(handle) {
  // Sleep 2000ms before making the HTTP call to guard the Codeforces API rate limit
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  try {
    console.log(`[CF API] Fetching submissions for handle: ${handle}`);
    const url = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=10`;
    const response = await axios.get(url);
    if (response.data && response.data.status === 'OK') {
      return response.data.result;
    }
    return [];
  } catch (error) {
    console.error(`[CF API] Error fetching submissions for ${handle}:`, error.message);
    return [];
  }
}

/**
 * Core processor for active Mode A matches.
 */
async function processActiveMatches() {
  // 1. Query active matches for Mode A
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'active')
    .eq('mode', 'Mode A');

  if (error) {
    console.error('Error fetching active matches:', error.message);
    return;
  }

  if (!matches || matches.length === 0) {
    return;
  }

  // 2. Extract unique player IDs
  const playerIds = new Set();
  matches.forEach((m) => {
    if (m.player_1_id) playerIds.add(m.player_1_id);
    if (m.player_2_id) playerIds.add(m.player_2_id);
  });

  if (playerIds.size === 0) return;

  // 3. Fetch handles for all active players
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, handle')
    .in('id', Array.from(playerIds));

  if (userError) {
    console.error('Error fetching user profiles:', userError.message);
    return;
  }

  const handleMap = {};
  users.forEach((u) => {
    handleMap[u.id] = u.handle;
  });

  // 4. Build sequential task queue
  const tasks = [];
  matches.forEach((match) => {
    if (match.player_1_id && handleMap[match.player_1_id]) {
      tasks.push({
        match,
        playerId: match.player_1_id,
        handle: handleMap[match.player_1_id],
        role: 'player_1',
      });
    }
    if (match.player_2_id && handleMap[match.player_2_id]) {
      tasks.push({
        match,
        playerId: match.player_2_id,
        handle: handleMap[match.player_2_id],
        role: 'player_2',
      });
    }
  });

  // 5. Execute tasks sequentially with 2000ms delay enforced per task
  for (const task of tasks) {
    const { match, playerId, handle, role } = task;

    // Fetch submissions from Codeforces (contains the 2000ms sleep)
    const submissions = await fetchUserSubmissions(handle);

    // Filter for OK (Accepted) submissions
    const acceptedSubmissions = submissions.filter(
      (sub) => sub.verdict === 'OK'
    );

    if (acceptedSubmissions.length === 0) continue;

    // Retrieve latest match state from DB (to prevent overwriting updates made during this loop)
    const { data: currentMatch, error: refreshError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', match.id)
      .single();

    if (refreshError || !currentMatch || currentMatch.status !== 'active') {
      continue;
    }

    let updatedProblems = [...(currentMatch.problems || [])];
    let scoreIncrement = 0;
    let matchUpdated = false;

    // Compare submissions with problems in the match
    for (const submission of acceptedSubmissions) {
      const contestId = submission.problem.contestId;
      const index = submission.problem.index;

      const problemIndex = updatedProblems.findIndex(
        (p) => p.contestId === contestId && p.index === index
      );

      if (problemIndex !== -1) {
        const problem = updatedProblems[problemIndex];

        // Check if the problem is not yet locked
        if (!problem.locked) {
          problem.locked = true;
          problem.locked_by = playerId;
          problem.locked_at = new Date().toISOString();
          scoreIncrement += problem.points;
          matchUpdated = true;
          console.log(`[LOCK] Player ${handle} solved and locked problem ${problem.name} for ${problem.points} points!`);
        }
      }
    }

    if (matchUpdated) {
      // Calculate new score
      const scoreColumn = role === 'player_1' ? 'player_1_score' : 'player_2_score';
      const currentScore = currentMatch[scoreColumn] || 0;
      const newScore = currentScore + scoreIncrement;

      // Check if all problems are locked now
      const allLocked = updatedProblems.every((p) => p.locked === true);
      const nextStatus = allLocked ? 'completed' : 'active';

      // Update match row
      const { data: finalMatch, error: updateError } = await supabase
        .from('matches')
        .update({
          problems: updatedProblems,
          [scoreColumn]: newScore,
          status: nextStatus,
          ...(allLocked ? { completed_at: new Date().toISOString() } : {}),
        })
        .eq('id', currentMatch.id)
        .select()
        .single();

      if (updateError) {
        console.error(`Failed to update match ${currentMatch.id}:`, updateError.message);
      } else if (allLocked) {
        console.log(`[MATCH COMPLETE] Match ${currentMatch.id} completed! All problems solved.`);
        await freePlayers(currentMatch.player_1_id, currentMatch.player_2_id);
        await triggerEloCalculation(currentMatch.id);
      }
    }
  }
}

/**
 * Start the background worker process.
 */
export function startMatchWorker() {
  console.log('[WORKER] Match background polling worker started.');
  
  async function run() {
    try {
      await processActiveMatches();
    } catch (err) {
      console.error('[WORKER] Error in execution loop:', err.message);
    }
    // Check again in 5 seconds (non-overlapping)
    setTimeout(run, 5000);
  }

  run();
}
