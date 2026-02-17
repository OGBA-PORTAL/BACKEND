import { JwtPayload } from 'jsonwebtoken';

declare global {
    namespace Express {
        interface Request {
            user?: any; // Replace 'any' with your User type when available
        }
    }
}
