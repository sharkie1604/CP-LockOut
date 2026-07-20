import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'undefined'
  ? import.meta.env.VITE_SUPABASE_URL
  : 'https://tneooihwrkoqnppcmtod.supabase.co';

const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY && import.meta.env.VITE_SUPABASE_ANON_KEY !== 'undefined'
  ? import.meta.env.VITE_SUPABASE_ANON_KEY
  : 'sb_publishable_irnLf4YMCIL3-esvjuTP-g_CC6nOz_4';

export const supabase = createClient(supabaseUrl, supabaseKey);
