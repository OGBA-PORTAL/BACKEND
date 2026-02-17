import bcrypt from 'bcrypt';
import { supabase } from '../config/supabase.js';
import { generateRaNumber } from '../utils/raGenerator.js';
import { AppError } from '../utils/AppError.js';

export class AuthService {
    async signup(userData: any) {
        // 1) Verify Church ID is present (required for RA Number)
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
                rankId: userData.rankId, // Persist Rank
                role: 'RA', // Default role. Admin roles should be set via specific admin-creation flows or manual Override if needed.
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

        return user; // Controller will handle token generation
    }
}

export const authService = new AuthService();
