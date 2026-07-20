import express from 'express';
import supabase from './db.js';
import { createMatch, joinMatch, leaveMatch } from './matchController.js';

const router = express.Router();

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
      .in('status', ['waiting', 'active']);

    if (matchError) {
      return res.status(500).json({ error: matchError.message });
    }

    if (matches && matches.length > 0) {
      return res.status(200).json({ match: matches[0] });
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
        .update({ status: 'free' })
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
      .in('status', ['waiting', 'active']);

    if (matchError) {
      return res.status(500).json({ error: matchError.message });
    }

    if (matches && matches.length > 0) {
      return res.status(200).json({ activeMatch: matches[0] });
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
    const { data: match, error } = await supabase
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
