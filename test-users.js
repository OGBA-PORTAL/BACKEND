import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  const { data } = await supabase.from('users').select('raNumber, firstName, lastName').eq('firstName', 'Test').eq('lastName', 'Student').order('createdAt', { ascending: false }).limit(1);
  console.log(JSON.stringify(data, null, 2));
}
check();
