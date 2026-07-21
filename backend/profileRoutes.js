import express from 'express';
import axios from 'axios';
import supabase from './db.js';

const router = express.Router();


// POST /verify-handle
router.post('/verify-handle', async (req, res) => {
  const { userId, handle, name, college, gradYear, check } = req.body;

  if (!handle || !name || !college || !gradYear) {
    return res.status(400).json({ error: 'Missing required profile fields (handle, name, college, gradYear).' });
  }

  const normalizedHandle = handle.toLowerCase();

  try {
    // Short-circuit if user is already verified
    if (userId) {
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('status, cf_handle')
        .eq('id', userId)
        .maybeSingle();

      if (!checkError && existingUser && existingUser.status === 'VERIFIED') {
        return res.status(200).json({ success: true, message: 'Profile verified and updated successfully.' });
      }
    }

    // 1. Initial Request: Generate and return a unique token
    if (!check) {
      const token = `LOCKOUT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      
      if (userId) {
        const { error: updateErr } = await supabase
          .from('users')
          .update({ cf_handle: token })
          .eq('id', userId);
        
        if (updateErr) {
          console.error('[TOKEN PERSIST ERROR]:', updateErr.message);
          return res.status(500).json({ error: `Failed to save token to database: ${updateErr.message}` });
        }
      }

      return res.status(200).json({
        requiresVerification: true,
        token,
        message: `Please update your Codeforces Profile First/Last Name to this exact token: ${token}`
      });
    }

    // 2. Verification Check Request
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required for verification check.' });
    }

    const { data: existingUser, error: fetchErr } = await supabase
      .from('users')
      .select('cf_handle')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr || !existingUser || !existingUser.cf_handle) {
      return res.status(400).json({ error: 'No active verification token found in database. Please request a new token.' });
    }

    const token = existingUser.cf_handle;

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
        name,
        college,
        grad_year: gradYear,
        handle: userProfile.handle,
        rating,
        status: 'VERIFIED',
        cf_handle: null // Clear the token now that it's verified
      };

      // Update the user's permanent record in the Supabase 'users' table targeting their authenticated ID
      const { data: dbData, error: dbError } = await supabase
        .from('users')
        .update(payload)
        .eq('id', userId)
        .select();

      console.log("Database update payload:", { handle: userProfile.handle, name, college, status: 'VERIFIED' });
      console.log("Database update result:", dbData);

      if (dbError) {
        console.error('[ONBOARDING DB UPDATE ERROR]:', dbError.message);
        return res.status(500).json({ error: `Failed to update user in database: ${dbError.message}` });
      }

      if (!dbData || dbData.length === 0) {
        console.warn(`[ONBOARDING DB UPDATE FAILED] No rows updated for userId: ${userId}`);
        return res.status(400).json({ error: 'User profile not found in database. Please ensure signup trigger completed.' });
      }

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

// GET /:userId
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error(`Database error looking up user ${userId}:`, error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error(`Error in GET /profile/${userId}:`, error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
