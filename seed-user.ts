import { authService } from './src/services/auth.service.js';
import { supabase } from './src/config/supabase.js';

async function seed() {
    try {
        console.log('Fetching a church and a rank...');
        const { data: churches } = await supabase.from('churches').select('id').limit(1);
        const { data: ranks } = await supabase.from('ranks').select('id').eq('level', 1).limit(1);
        
        if (!churches?.length || !ranks?.length) {
            console.error('No churches or ranks found in the DB. Please create them first.');
            process.exit(1);
        }

        const churchId = churches[0].id;
        const rankId = ranks[0].id;
        const raNumber = `TEST-RA-${Math.floor(Math.random() * 10000)}`;

        console.log(`Creating user with RA Number: ${raNumber} and Password: password123`);

        const user = await authService.signup({
            firstName: 'Test',
            lastName: 'Student',
            raNumber,
            password: 'password123',
            role: 'RA',
            churchId,
            rankId
        });
        
        // Also automatically activate them so they can log in immediately
        const { error: activeError } = await supabase.from('users').update({ status: 'ACTIVE' }).eq('id', user.id);
        if (activeError) throw activeError;

        console.log('\n--- SUCCESS ---');
        console.log(`Login URL: http://localhost:3000/login`);
        console.log(`RA Number: ${raNumber}`);
        console.log(`Password: password123`);
        console.log('-----------------\n');
        process.exit(0);
    } catch (e) {
        console.error('Error seeding user:', e);
        process.exit(1);
    }
}

seed();
