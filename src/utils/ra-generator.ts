/**
 * RA Number Generator Utility
 * Format: RA/OGBA/CCC/YYYY/NNNN
 */

interface RANumberComponents {
    churchCode: string; // CCC (3 chars)
    year: number;       // YYYY
    sequence: number;   // NNNN
}

export const generateRANumber = ({ churchCode, year, sequence }: RANumberComponents): string => {
    if (churchCode.length !== 3) {
        throw new Error('Church code must be exactly 3 characters');
    }

    const paddedSequence = sequence.toString().padStart(4, '0');

    return `RA/OGBA/${churchCode.toUpperCase()}/${year}/${paddedSequence}`;
};

/**
 * Parses an RA number into its components
 */
export const parseRANumber = (raNumber: string) => {
    const parts = raNumber.split('/');
    if (parts.length !== 5) return null;

    const [prefix, association, churchCode, year, sequence] = parts;

    if (prefix !== 'RA' || association !== 'OGBA') return null;

    return {
        churchCode,
        year: parseInt(year, 10),
        sequence: parseInt(sequence, 10)
    };
};
