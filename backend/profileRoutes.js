import express from 'express';
import axios from 'axios';
import supabase from './db.js';

const router = express.Router();

// Temporary in-memory storage for verification tokens. 
// Keys: handle (lowercased), Values: token
// In production, this should be moved to Redis or a database table with an expiry.
const verificationTokens = new Map();

// POST /verify-handle
router.post('/verify-handle', async (req, res) => {
  const { userId, handle, name, college, gradYear, check } = req.body;

  if (!handle || !name || !college || !gradYear) {
    return res.status(400).json({ error: 'Missing required profile fields (handle, name, college, gradYear).' });
  }

  const normalizedHandle = handle.toLowerCase();

  try {
    // 1. Initial Request: Generate and return a unique token
    if (!check) {
      let token = verificationTokens.get(normalizedHandle);
      if (!token) {
        token = `LOCKOUT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        verificationTokens.set(normalizedHandle, token);
      }
      return res.status(200).json({
        requiresVerification: true,
        token,
        message: `Please update your Codeforces Profile First/Last Name to this exact token: ${token}`
      });
    }

    // 2. Verification Check Request
    const token = verificationTokens.get(normalizedHandle);
    if (!token) {
      return res.status(400).json({ error: 'No active verification session found. Please request a new token.' });
    }

    // Fetch user info from Codeforces API
    const cfRes = await axios.get(`https://codeforces.com/api/user.info?handles=${handle}`);
    const cfData = cfRes.data;

    if (cfData.status !== 'OK' || !cfData.result || cfData.result.length === 0) {
      return res.status(400).json({ error: 'Failed to retrieve user from Codeforces API. Please verify your handle spelling.' });
    }

    const userProfile = cfData.result[0];
    
    // Check if the exact generated token is present in the first or last name
    const firstNameMatch = userProfile.firstName && userProfile.firstName.includes(token);
    const lastNameMatch = userProfile.lastName && userProfile.lastName.includes(token);

    if (firstNameMatch || lastNameMatch) {
      // SUCCESS: Token matches!
      const rating = userProfile.rating || 0;
      
      const payload = {
        handle: userProfile.handle,
        name,
        college,
        grad_year: gradYear,
        rating,
        status: 'free'
      };

      // Since users table in this project typically tracks by user 'id' (UUID),
      // we inject it if it is provided by the frontend.
      if (userId) {
        payload.id = userId;
      }

      // Upsert the user's permanent record in the Supabase 'users' table
      const { error: dbError } = await supabase
        .from('users')
        .upsert(payload, { onConflict: userId ? 'id' : 'handle' });

      if (dbError) {
        console.error('Supabase update error:', dbError);
        return res.status(500).json({ error: `Failed to update user in database: ${dbError.message}` });
      }

      // Clear the token state
      verificationTokens.delete(normalizedHandle);

      return res.status(200).json({ success: true, message: 'Profile verified and updated successfully.' });
    } else {
      // FAILS: Token mismatch
      return res.status(400).json({ 
        error: 'Validation mismatch. The generated token was not found in your Codeforces profile name.',
        expectedToken: token
      });
    }
  } catch (error) {
    console.error('Error in /verify-handle:', error.message);
    
    // Explicit error handling for Axios API failures (e.g. rate limits, handle not found)
    if (error.response) {
       return res.status(400).json({ error: `Codeforces API Error: ${error.response.data?.comment || 'Invalid handle'}` });
    }
    
    return res.status(500).json({ error: 'Internal server error during verification process.' });
  }
});

export default router;
