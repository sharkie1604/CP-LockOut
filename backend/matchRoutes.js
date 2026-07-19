import express from 'express';
import { createMatch, joinMatch } from './matchController.js';

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

export default router;
