import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function inspect() {
  try {
    const response = await axios.get(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const definitions = response.data.definitions;
    if (definitions && definitions.users) {
      console.log('=== USERS TABLE COLUMNS ===');
      console.log(Object.keys(definitions.users.properties));
    } else {
      console.log('No definitions found for users.');
    }
  } catch (err) {
    console.error('Inspection error:', err.message);
  }
}

inspect();
