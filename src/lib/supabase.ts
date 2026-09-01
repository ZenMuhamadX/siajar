import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://192.168.1.230:8000';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'agenda' },
});
