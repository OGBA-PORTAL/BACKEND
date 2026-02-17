import { supabase } from '../config/supabase.js';
import { AppError } from './AppError.js';

export const generateRaNumber = async (churchId: string): Promise<string> => {
    // 1. Get Church Code
    const { data: church, error: churchError } = await supabase
        .from('churches')
        .select('code')
        .eq('id', churchId)
        .single();

    if (churchError || !church) {
        throw new AppError('Invalid Church ID provided for RA Number generation', 400);
    }

    const churchCode = church.code;
    const associationCode = 'OGBA'; // Hardcoded for this association
    const year = new Date().getFullYear();

    // 2. Find last sequence for this church and year
    // Pattern to search: RA/OGBA/CCC/YYYY/%
    const prefix = `RA/${associationCode}/${churchCode}/${year}/`;

    const { data: lastUser, error: lastUserError } = await supabase
        .from('users')
        .select('raNumber')
        .ilike('raNumber', `${prefix}%`)
        .order('raNumber', { ascending: false })
        .limit(1)
        .single();

    let sequence = 1;

    if (lastUser && lastUser.raNumber) {
        // Extract sequence part: RA/OGBA/CCC/YYYY/NNNN
        const parts = lastUser.raNumber.split('/');
        const lastSeqStr = parts[parts.length - 1]; // NNNN
        const lastSeq = parseInt(lastSeqStr, 10);

        if (!isNaN(lastSeq)) {
            sequence = lastSeq + 1;
        }
    }

    // 3. Increment and Pad (NNNN)
    const sequenceStr = sequence.toString().padStart(4, '0');

    // 4. Construct RA Number
    return `${prefix}${sequenceStr}`;
};
