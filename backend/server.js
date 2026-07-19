import supabase from './db.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import matchRoutes from './matchRoutes.js';
import { startMatchWorker } from './matchWorker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Register API routes
app.use('/api/matches', matchRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start the background polling queue worker
  startMatchWorker();
});
