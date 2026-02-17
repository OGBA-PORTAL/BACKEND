import { generateRaNumber } from '../src/utils/raGenerator.js';
import { supabase } from '../src/config/supabase.js';
import bcrypt from 'bcrypt';

const seedAdmin = async () => {
    console.log('Seeding System Admin...');

    // 1. Ensure we have a church (e.g., Headquarters or Placeholder)
    // For System Admin, we might not strictly need a church, but RA Number generator expects it.
    // Let's check for an existing church or insert one.

    // 1. Create HQ Church (for System Admin)
    let hqChurchId;
    const { data: hqChurch } = await supabase.from('churches').select('id').eq('code', 'HQ').single();

    if (hqChurch) {
        hqChurchId = hqChurch.id;
    } else {
        const { data: newHq, error } = await supabase.from('churches').insert({
            name: 'Headquarters', code: 'HQ', phone: '0000000000'
        }).select().single();
        if (error) { console.error('Error creating HQ:', error); return; }
        hqChurchId = newHq.id;
    }

    // 2. Create Association Council Church (for Association Officers)
    const { data: assocChurch } = await supabase.from('churches').select('id').eq('code', 'ASSOC').single();
    if (!assocChurch) {
        await supabase.from('churches').insert({
            name: 'Association Council', code: 'ASSOC', phone: '0000000000'
        });
        console.log('Created Association Council (ASSOC) church entity.');
    }

    // 2. Create User
    const raNumber = `RA/OGBA/HQ/${new Date().getFullYear()}/ADMIN`;
    const password = await bcrypt.hash('admin123', 12);

    const { data: newUser, error } = await supabase
        .from('users')
        .insert({
            raNumber: raNumber,
            password: password,
            firstName: 'System',
            lastName: 'Admin',
            role: 'SYSTEM_ADMIN',
            churchId: hqChurchId
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating admin:', error);
    } else {
        console.log('Admin created successfully!');
        console.log(`RA Number: ${newUser.raNumber}`);
        console.log('Password: admin123');
    }
};

seedAdmin();
