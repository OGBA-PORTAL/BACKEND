
import { supabase } from '../src/config/supabase.js';

const BASE_URL = 'http://localhost:3000/api';
const RA_PASS = 'TestRA123!';

// Shared State for Cleanup
let createdExamId: string | null = null;
let createdUserId: string | null = null;
let adminToken: string | null = null;

const request = async (method: string, endpoint: string, token: string | null, body: any = null) => {
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`[${method}] ${endpoint} failed: ${JSON.stringify(data)}`);
    }
    return data;
};

const runVerification = async () => {
    try {
        console.log('🚀 Starting Verification Workflow...');

        // 0. Login Admin
        console.log('🔑 Logging in as System Admin...');
        const adminLogin = await request('POST', '/auth/login', null, {
            raNumber: 'RA/OGBA/HQ/2026/ADMIN', // From seedAdmin.ts output
            password: 'admin123'
        });
        adminToken = adminLogin.token;

        // 1. Create Exam
        const ranksRes = await request('GET', '/ranks', null);
        const rankId = ranksRes.data.ranks[0].id;

        const examRes = await request('POST', '/exams', adminToken, {
            title: `Verification Exam ${Date.now()}`,
            rankId,
            duration: 30,
            passMark: 50,
            questionCount: 2,
            description: "Test Exam API"
        });
        createdExamId = examRes.data.exam.id;
        console.log(`✅ Exam Created: ${createdExamId}`);

        // 2. Add Questions
        await request('POST', `/exams/${createdExamId}/questions`, adminToken, {
            examId: createdExamId, text: "What is 2+2?", type: "MCQ",
            options: ["3", "4", "5", "6"], correctOption: 1, points: 5
        });
        await request('POST', `/exams/${createdExamId}/questions`, adminToken, {
            examId: createdExamId, text: "Who built the Ark?", type: "MCQ",
            options: ["Noah", "Moses", "David", "Jesus"], correctOption: 0, points: 5
        });

        // 3. Publish
        await request('PATCH', `/exams/${createdExamId}/publish`, adminToken);
        console.log('✅ Exam Published.');

        // 4. Register Logic (We simulate a student signup)
        const churchRes = await request('GET', '/churches', adminToken);
        const churchId = churchRes.data.churches[0].id;

        // Note: Signup endpoint usually returns token.
        // We use a random name to avoid conflict.
        const randomSuffix = Math.floor(Math.random() * 1000);
        const raSignup = await request('POST', '/auth/signup', null, {
            firstName: `Verify${randomSuffix}`, lastName: "Student",
            churchId, rankId, password: RA_PASS
        });
        const raToken = raSignup.token;
        createdUserId = raSignup.data.user.id;
        console.log(`✅ Student Registered: ${raSignup.data.user.raNumber}`);

        // 5. Start Attempt
        const attemptStart = await request('POST', '/exams/start', raToken, { examId: createdExamId });
        const attemptId = attemptStart.data.attemptId;
        const questions = attemptStart.data.questions;
        console.log(`✅ Exam Started with ${questions.length} questions.`);

        // 6. Submit
        const answers: any = {};
        for (const q of questions) {
            if (q.text.includes("2+2")) {
                const optIndex = q.options.findIndex((o: any) => o.text === "4");
                answers[q.id] = q.options[optIndex].id;
            } else if (q.text.includes("Ark")) {
                const optIndex = q.options.findIndex((o: any) => o.text === "Noah");
                answers[q.id] = q.options[optIndex].id;
            }
        }

        const submitRes = await request('POST', '/exams/submit', raToken, { attemptId, answers });
        console.log(`✅ Score: ${submitRes.data.score}/${submitRes.data.totalPoints}`);

        // 7. Release Results
        await request('POST', '/results/admin/release', adminToken, { examId: createdExamId, release: true });
        console.log('✅ Results Released.');

        // 8. Check
        const myRes = await request('GET', '/results/me', raToken);
        const myAttempt = myRes.data.results.find((r: any) => r.examId === createdExamId);
        if (myAttempt && myAttempt.score !== null) {
            console.log(`✅ Student sees released score: ${myAttempt.score}`);
        } else {
            throw new Error('Student cannot see score!');
        }

        console.log('🎉 VERIFICATION SUCCESSFUL!');

    } catch (error: any) {
        console.error('❌ Verification Failed:', error.message);
    } finally {
        console.log('\n🧹 CLEANING UP TEST DATA...');
        // Delete User (Cascades to Attempts)
        if (createdUserId) {
            const { error } = await supabase.from('users').delete().eq('id', createdUserId);
            if (error) console.error('Failed to delete test user:', error.message);
            else console.log('✅ Test User Deleted.');
        }

        // Delete Exam (Cascades to Questions)
        if (createdExamId) {
            const { error } = await supabase.from('exams').delete().eq('id', createdExamId);
            if (error) console.error('Failed to delete test exam:', error.message);
            else console.log('✅ Test Exam Deleted.');
        }
        console.log('✨ Cleanup Complete. Database is clean.');
    }
};

runVerification();
