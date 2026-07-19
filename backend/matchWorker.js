import axios from 'axios';
import supabase from './db.js';

// Simple placeholder for Elo calculation wrapper
async function triggerEloCalculation(matchId) {
  console.log(`[ELO] Triggering Elo calculation wrapper for match ${matchId}`);
  // In a full implementation, this would fetch the match, calculate new ratings,
  // update the users table ratings, and log to leaderboard/match history.
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
