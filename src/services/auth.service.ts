import bcrypt from 'bcrypt';
import { supabase } from '../config/supabase.js';
import { generateRaNumber } from '../utils/raGenerator.js';
import { AppError } from '../utils/AppError.js';

export class AuthService {
    async signup(userData: any) {
        // Sanitize inputs: Convert empty strings to null/undefined
        if (userData.churchId === '') userData.churchId = null;
        if (userData.rankId === '') userData.rankId = null;
        if (userData.role === '') userData.role = null;

        // 1) Handle Special Roles (Assoc Officer / Sys Admin) that might not send churchId
        if (!userData.churchId) {
            if (userData.role === 'ASSOCIATION_OFFICER') {
                const { data: assocChurch } = await supabase.from('churches').select('id').eq('code', 'ASSOC').single();
                if (assocChurch) userData.churchId = assocChurch.id;
            } else if (userData.role === 'SYSTEM_ADMIN') {
                const { data: hqChurch } = await supabase.from('churches').select('id').eq('code', 'HQ').single();
                if (hqChurch) userData.churchId = hqChurch.id;
            }
        }

        // 2) Verify Church ID is present (required for RA Number)
        if (!userData.churchId) {
            throw new AppError('Church ID is required to generate RA Number', 400);
        }

        // 2) Generate RA Number
        const raNumber = await generateRaNumber(userData.churchId);

        // 3) Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 12);

        // 4) Create user
        const { data: newUser, error } = await supabase
            .from('users')
            .insert({
                raNumber,
                password: hashedPassword,
                firstName: userData.firstName,
                lastName: userData.lastName,
                churchId: userData.churchId,
                rankId: userData.rankId,
                role: userData.role || 'RA',
            })
            .select()
            .single();

        if (error) {
            throw new AppError(error.message, 500);
        }

        return newUser;
    }

    async login(raNumber: string, password: string) {
        // 1) Check if email and password exist
        if (!raNumber || !password) {
            throw new AppError('Please provide RA Number and password', 400);
        }

        // 2) Check if user exists
        const { data: user, error } = await supabase
            .from('users')
            .select('*') // We need password to compare
            .eq('raNumber', raNumber)
            .single();

        if (error || !user) {
            throw new AppError('Incorrect RA Number or password', 401);
        }

        // 3) Check if password is correct
        const correct = await bcrypt.compare(password, user.password);

        if (!correct) {
            throw new AppError('Incorrect RA Number or password', 401);
        }

        // 4) Check Status
        if (user.status === 'SUSPENDED') {
            throw new AppError('Your account has been suspended. Please contact support.', 403);
        }
        if (user.status === 'PENDING_ACTIVATION') {
            throw new AppError('Your account is pending activation. Please wait for administrator approval.', 403);
        }

        return user; // Controller will handle token generation
    }
}

export const authService = new AuthService();
