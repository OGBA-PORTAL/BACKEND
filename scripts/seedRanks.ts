import { supabase } from '../src/config/supabase.js';

const ranks = [
    { name: 'Assistant Intern', level: 1 },
    { name: 'Intern', level: 2 },
    { name: 'Senior Intern', level: 3 },
    { name: 'Envoy', level: 4 },
    { name: 'Special Envoy', level: 5 },
    { name: 'Senior Envoy', level: 6 },
    { name: 'Dean', level: 7 },
    { name: 'Ambassador', level: 8 },
    { name: 'Ambassador Extraordinary', level: 9 },
    { name: 'Ambassador Plenipotentiary', level: 10 }
];

const seedRanks = async () => {
    console.log('Seeding Ranks...');

    for (const rank of ranks) {
        // Check if exists
        const { data: existing } = await supabase
            .from('ranks')
            .select('id')
            .eq('name', rank.name)
            .single();

        if (existing) {
            console.log(`Rank '${rank.name}' already exists.`);
        } else {
            const { error } = await supabase
                .from('ranks')
                .insert(rank);

            if (error) {
                console.error(`Error inserting ${rank.name}:`, error.message);
            } else {
                console.log(`Inserted Rank: ${rank.name} (Level ${rank.level})`);
            }
        }
    }

    console.log('Rank seeding complete.');
};

seedRanks();
