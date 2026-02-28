
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function activateSysAdmin() {
    console.log('🔄 Attempting to activate System Admin...');

    const { data, error } = await supabase
        .from('users')
        .update({ status: 'ACTIVE' })
        .eq('role', 'SYSTEM_ADMIN')
        .select();

    if (error) {
        console.error('❌ Error activating admin:', error);
    } else {
        console.log('✅ System Admin(s) activated:', data.length);
        console.log(data);
    }
}

activateSysAdmin();