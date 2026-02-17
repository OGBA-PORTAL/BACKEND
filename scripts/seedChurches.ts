import { supabase } from '../src/config/supabase.js';
import fs from 'fs';
import path from 'path';

const seedChurches = async () => {
    console.log('Seeding Churches from data/churches.json...');

    const dataPath = path.join(process.cwd(), 'data', 'churches.json');

    if (!fs.existsSync(dataPath)) {
        console.error('Error: data/churches.json not found!');
        process.exit(1);
    }

    const fileContent = fs.readFileSync(dataPath, 'utf-8');
    const churches = JSON.parse(fileContent);

    console.log(`Found ${churches.length} churches to import.`);

    for (const church of churches) {
        // Check if exists by code
        const { data: existing } = await supabase
            .from('churches')
            .select('id')
            .eq('code', church.code)
            .single();

        if (existing) {
            console.log(`Skipping ${church.name} (${church.code}) - Already exists.`);
        } else {
            const { error } = await supabase.from('churches').insert(church);
            if (error) {
                console.error(`Error inserting ${church.name}:`, error.message);
            } else {
                console.log(`Inserted: ${church.name}`);
            }
        }
    }

    console.log('Church seeding complete.');
};

seedChurches();
