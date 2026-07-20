import express from 'express';
import supabase from './db.js';
import { createMatch, joinMatch, leaveMatch, startMatch } from './matchController.js';

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

export default router;
