import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
dotenv.config();

// MUST use service role key to bypass RLS, anon key won't read ranks properly
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function seed() {
    console.log("Seeding Dean Exam & Senior Envoy User...");

    // 1. Get Ranks
    const { data: ranks, error: rankErr } = await supabase.from('ranks').select('*');
    if (rankErr || !ranks) {
        console.error("Failed to fetch ranks! Missing Service Role Key?", rankErr);
        return;
    }

    const deanRank = ranks.find(r => r.name.toLowerCase().includes('dean'));
    const envoyRank = ranks.find(r => r.name.toLowerCase().includes('senior envoy'));

    if (!deanRank || !envoyRank) {
        console.error("Missing ranks!", { deanRank, envoyRank });
        return;
    }

    console.log("Found Ranks. Dean:", deanRank.id, "Envoy:", envoyRank.id);

    // 2. Get a church
    const { data: church } = await supabase.from('churches').select('*').limit(1).single();

    if (!church) {
        console.error("No church found in DB to link user to.");
        return;
    }

    // 3. Create Senior Envoy User
    const hpass = await bcrypt.hash('password123', 10);
    const churchCode = church.code || 'TEST';
    const testRaNumber = `RA/OGBA/${churchCode}/2026/0001`;

    // delete if exists
    await supabase.from('users').delete().eq('raNumber', testRaNumber);
    await supabase.from('users').delete().eq('raNumber', 'RA-TEST-DEAN-001'); // clean old one
    // also delete old exams
    await supabase.from('exams').delete().eq('title', 'Dean Annual Examination 2026');

    const { data: user, error: userErr } = await supabase.from('users').insert({
        firstName: 'Test',
        lastName: 'SeniorEnvoy',
        raNumber: testRaNumber,
        churchId: church.id,
        rankId: envoyRank.id,
        role: 'RA',
        password: hpass,
        status: 'ACTIVE'
    }).select().single();

    if (userErr) {
        console.error("Failed to create user", userErr);
        return;
    } else {
        console.log(`Created User! raNumber: ${user.raNumber}, Password: password123`);
    }

    // 4. Create Exam
    const { data: admin } = await supabase.from('users').select('id').eq('role', 'SYSTEM_ADMIN').limit(1).single();

    // Set examDate to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: exam, error: examErr } = await supabase.from('exams').insert({
        title: 'Dean Annual Examination 2026',
        description: 'Comprehensive test for prospective Deans.',
        duration: 45,
        passMark: 70,
        questionCount: 50,
        rankId: deanRank.id,
        createdBy: admin?.id || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY, // fallback if no admin found
        examDate: today.toISOString(),
        status: 'DRAFT'
    }).select().single();

    if (examErr) {
        console.error("Failed to create exam", examErr);
        return;
    }
    console.log("Created Exam:", exam.title);

    // 5. Create 50 Questions
    const questionsToInsert = [];
    for (let i = 1; i <= 50; i++) {
        questionsToInsert.push({
            examId: exam.id,
            text: `Sample Dean Question ${i}: What is the primary responsibility of a Dean?`,
            type: 'MCQ',
            options: JSON.stringify(['Leading RA activities', 'Managing finances', 'Teaching advanced rank material', 'Organizing sports']),
            correctOption: 2, // "Teaching advanced rank material"
            points: 2
        });
    }

    // insert in batches of 10
    for (let i = 0; i < 50; i += 10) {
        const batch = questionsToInsert.slice(i, i + 10);
        const { error: qErr } = await supabase.from('questions').insert(batch);
        if (qErr) {
            console.error("Failed to insert questions", qErr);
            return;
        }
    }
    console.log("Added 50 questions.");

    // 6. Publish Exam
    await supabase.from('exams').update({ status: 'PUBLISHED' }).eq('id', exam.id);
    console.log("Exam Published!");
    console.log("------------------------------------------");
    console.log("Done! You can login with:");
    console.log(`Login identifier (RA Number): ${testRaNumber}`);
    console.log("Password:                     password123");
    console.log("------------------------------------------");
}

seed().catch(console.error);
