import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  const { data } = await supabase.from('questions').select('id, text, options').limit(2);
  console.log(JSON.stringify(data, null, 2));
}
check();
