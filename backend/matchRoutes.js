import express from 'express';
import axios from 'axios';
import supabase from './db.js';
import { createMatch, joinMatch, leaveMatch, startMatch, broadcastMatchUpdate } from './matchController.js';
import { freePlayers, triggerEloCalculation } from './matchWorker.js';

const router = express.Router();

async function injectProfiles(match) {
  if (!match) return match;
  const playerIds = [match.player_1_id, match.player_2_id].filter(Boolean);
  if (playerIds.length === 0) return match;
  
  const { data: users } = await supabase
    .from('users')
    .select('id, handle, rating, college, name')
    .in('id', playerIds);
    
  if (users) {
    match.player1_profile = users.find(u => u.id === match.player_1_id) || null;
    match.player2_profile = users.find(u => u.id === match.player_2_id) || null;
  }
  return match;
}

// POST /create
router.post('/create', async (req, res) => {
  const { player1Id, minRating, maxRating } = req.body;

  if (!player1Id || minRating === undefined || maxRating === undefined) {
    return res.status(400).json({ error: 'Missing required parameters: player1Id, minRating, maxRating' });
  }

  try {
    const match = await createMatch(player1Id, Number(minRating), Number(maxRating));
    return res.status(201).json(match);
  } catch (error) {
    console.error('Error in /create route:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// POST /join
router.post('/join', async (req, res) => {
  const { player2Id, roomCode } = req.body;

  if (!player2Id || !roomCode) {
    return res.status(400).json({ error: 'Missing required parameters: player2Id, roomCode' });
  }

  try {
    const match = await joinMatch(player2Id, roomCode);
    return res.status(200).json(match);
  } catch (error) {
    console.error('Error in /join route:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// POST /:id/start
router.post('/:id/start', async (req, res) => {
  const { id } = req.params;
  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: 'Missing required parameter: playerId' });
  }

  try {
    const match = await startMatch(id, playerId);
    return res.status(200).json(match);
  } catch (error) {
    console.error('Error in /start route:', error.message);
    return res.status(error.status || 500).json({ error: error.message });
  }
});

// GET /active
router.get('/active', async (req, res) => {
  const { playerId } = req.query;

  if (!playerId) {
    return res.status(400).json({ error: 'Missing required parameter: playerId' });
  }

  try {
    // 1. Look up any active/waiting match involving this player
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .or(`player_1_id.eq.${playerId},player_2_id.eq.${playerId}`)
      .in('status', ['waiting', 'PENDING', 'active']);

    if (matchError) {
      return res.status(500).json({ error: matchError.message });
    }

    if (matches && matches.length > 0) {
      let activeMatch = matches[0];
      
      // Phase 5: Hard Expiration Check
      if (activeMatch.expires_at && new Date() > new Date(activeMatch.expires_at)) {
        console.log(`[LIFECYCLE] Match ${activeMatch.id} hard expired. Marking ENDED.`);
        const { data: updatedMatch } = await supabase
          .from('matches')
          .update({ status: 'ENDED' })
          .eq('id', activeMatch.id)
          .select()
          .single();
          
        if (updatedMatch) {
          activeMatch = updatedMatch;
        }
        
        // Free the players
        await supabase
          .from('users')
          .update({ status: 'VERIFIED' })
          .in('id', [activeMatch.player_1_id, activeMatch.player_2_id].filter(Boolean));
      }

      activeMatch = await injectProfiles(activeMatch);
      return res.status(200).json({ match: activeMatch });
    }

    // 2. If no active match is found, check if user status is stuck as 'busy'
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('status')
      .eq('id', playerId)
      .maybeSingle();

    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }

    if (userProfile && userProfile.status === 'busy') {
      console.log(`[SESSION BACKEND] User ${playerId} status stuck as busy. Freeing...`);
      await supabase
        .from('users')
        .update({ status: 'VERIFIED' })
        .eq('id', playerId);
    }

    return res.status(200).json({ match: null });
  } catch (error) {
    console.error('Error in /active route:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// GET /active/:playerId
router.get('/active/:playerId', async (req, res) => {
  const { playerId } = req.params;

  try {
    // 1. Look up any active/waiting match involving this player
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .or(`player_1_id.eq.${playerId},player_2_id.eq.${playerId}`)
      .in('status', ['waiting', 'PENDING', 'active']);

    if (matchError) {
      return res.status(500).json({ error: matchError.message });
    }

    if (matches && matches.length > 0) {
      let activeMatch = matches[0];
      
      // Phase 5: Hard Expiration Check
      if (activeMatch.expires_at && new Date() > new Date(activeMatch.expires_at)) {
        console.log(`[LIFECYCLE] Match ${activeMatch.id} hard expired. Marking ENDED.`);
        const { data: updatedMatch } = await supabase
          .from('matches')
          .update({ status: 'ENDED' })
          .eq('id', activeMatch.id)
          .select()
          .single();
          
        if (updatedMatch) {
          activeMatch = updatedMatch;
        }
        
        // Free the players
        await supabase
          .from('users')
          .update({ status: 'VERIFIED' })
          .in('id', [activeMatch.player_1_id, activeMatch.player_2_id].filter(Boolean));
      }

      activeMatch = await injectProfiles(activeMatch);
      return res.status(200).json({ activeMatch });
    }

    return res.status(200).json({ activeMatch: null });
  } catch (error) {
    console.error('Error in /active/:playerId route:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let { data: match, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Phase 5: Hard Expiration Check
    if (match.status === 'active' && match.expires_at && new Date() > new Date(match.expires_at)) {
      console.log(`[LIFECYCLE] Match ${match.id} hard expired via direct fetch. Marking ENDED.`);
      const { data: updatedMatch } = await supabase
        .from('matches')
        .update({ status: 'ENDED' })
        .eq('id', match.id)
        .select()
        .single();
        
      if (updatedMatch) {
        match = updatedMatch;
      }
      
      // Free the players
      await supabase
        .from('users')
        .update({ status: 'VERIFIED' })
        .in('id', [match.player_1_id, match.player_2_id].filter(Boolean));
    }

    match = await injectProfiles(match);
    return res.status(200).json(match);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /leave
router.post('/leave', async (req, res) => {
  const { playerId, matchId } = req.body;

  if (!playerId || !matchId) {
    return res.status(400).json({ error: 'Missing required parameters: playerId, matchId' });
  }

  try {
    const result = await leaveMatch(playerId, matchId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in /leave route:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// POST /abandon
router.post('/abandon', async (req, res) => {
  const { playerId, matchId } = req.body;

  if (!playerId || !matchId) {
    return res.status(400).json({ error: 'Missing required parameters: playerId, matchId' });
  }

  try {
    // 1. Fetch match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (match.status !== 'active') {
      return res.status(400).json({ error: 'Match is not active' });
    }

    // 2. Assign winner as the other player
    let winnerId = null;
    if (match.player_1_id === playerId) {
      winnerId = match.player_2_id;
    } else if (match.player_2_id === playerId) {
      winnerId = match.player_1_id;
    }

    // Update match status to ABANDONED and set winner_id
    const { data: updatedMatch, error: updateError } = await supabase
      .from('matches')
      .update({ status: 'ABANDONED', winner_id: winnerId })
      .eq('id', matchId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update match status: ${updateError.message}`);
    }

    // 3. Free both players back to VERIFIED
    await supabase
      .from('users')
      .update({ status: 'VERIFIED' })
      .in('id', [match.player_1_id, match.player_2_id].filter(Boolean));

    // Broadcast update
    broadcastMatchUpdate(updatedMatch.id, updatedMatch);

    return res.status(200).json({ success: true, match: updatedMatch });
  } catch (error) {
    console.error('Error in /abandon route:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// POST /sync/:id
router.post('/sync/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Fetch match state
    let { data: match, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (match.status !== 'active') {
      match = await injectProfiles(match);
      return res.status(200).json(match);
    }

    // 2. Fetch handles for both players
    const playerIds = [match.player_1_id, match.player_2_id].filter(Boolean);
    const { data: users } = await supabase
      .from('users')
      .select('id, handle')
      .in('id', playerIds);

    const handleMap = {};
    users?.forEach((u) => {
      handleMap[u.id] = u.handle;
    });

    const p1Handle = handleMap[match.player_1_id];
    const p2Handle = handleMap[match.player_2_id];

    let currentMatch = match;

    // Helper to fetch and lock for a single player
    const checkPlayer = async (playerId, handle, role) => {
      if (!handle) return;
      try {
        const cfRes = await axios.get(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=20`);
        if (cfRes.data.status !== 'OK') return;
        const submissions = cfRes.data.result || [];
        const acceptedSubmissions = submissions.filter((sub) => sub.verdict === 'OK');
        if (acceptedSubmissions.length === 0) return;

        let updatedProblems = [...(currentMatch.problems || [])];
        let scoreIncrement = 0;
        let matchUpdated = false;

        for (const submission of acceptedSubmissions) {
          const contestId = submission.problem.contestId;
          const index = submission.problem.index;
          const subKey = `${contestId}${index}`.toUpperCase().trim();

          const problemIndex = updatedProblems.findIndex((p) => {
            const dbKey = `${p.contestId || ''}${p.index || p.problemCode || ''}`.replace(/[- ]/g, '').toUpperCase().trim();
            return dbKey === subKey;
          });

          if (problemIndex !== -1) {
            const problem = updatedProblems[problemIndex];
            if (!problem.locked) {
              problem.locked = true;
              problem.locked_by = playerId;
              problem.locked_at = new Date().toISOString();
              scoreIncrement += problem.points;
              matchUpdated = true;
            }
          }
        }

        if (matchUpdated) {
          const scoreColumn = role === 'player_1' ? 'player_1_score' : 'player_2_score';
          const currentScore = currentMatch[scoreColumn] || 0;
          const newScore = currentScore + scoreIncrement;

          const p1Score = role === 'player_1' ? newScore : (currentMatch.player_1_score || 0);
          const p2Score = role === 'player_2' ? newScore : (currentMatch.player_2_score || 0);

          const remainingPoints = updatedProblems
            .filter((p) => !p.locked)
            .reduce((sum, p) => sum + (p.points || 0), 0);

          let nextStatus = 'active';
          let winnerId = null;

          if (p1Score > p2Score + remainingPoints) {
            nextStatus = 'FINISHED';
            winnerId = currentMatch.player_1_id;
          } else if (p2Score > p1Score + remainingPoints) {
            nextStatus = 'FINISHED';
            winnerId = currentMatch.player_2_id;
          } else {
            const allLocked = updatedProblems.every((p) => p.locked === true);
            if (allLocked) {
              nextStatus = 'FINISHED';
              if (p1Score > p2Score) {
                winnerId = currentMatch.player_1_id;
              } else if (p2Score > p1Score) {
                winnerId = currentMatch.player_2_id;
              }
            }
          }

          const { data: updated, error: updateError } = await supabase
            .from('matches')
            .update({
              problems: updatedProblems,
              [scoreColumn]: newScore,
              status: nextStatus,
              winner_id: winnerId,
            })
            .eq('id', currentMatch.id)
            .select()
            .single();

          if (!updateError && updated) {
            currentMatch = updated;
            broadcastMatchUpdate(updated.id, updated);
            if (nextStatus === 'FINISHED') {
              await freePlayers(currentMatch.player_1_id, currentMatch.player_2_id);
              await triggerEloCalculation(currentMatch.id);
            }
          }
        }
      } catch (err) {
        console.error(`[SYNC ERROR] Failed to sync handle ${handle}:`, err.message);
      }
    };

    // Sequentially check player 1 and player 2
    if (p1Handle) await checkPlayer(match.player_1_id, p1Handle, 'player_1');
    if (p2Handle) await checkPlayer(match.player_2_id, p2Handle, 'player_2');

    currentMatch = await injectProfiles(currentMatch);
    return res.status(200).json(currentMatch);
  } catch (err) {
    console.error('Error in /sync route:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
