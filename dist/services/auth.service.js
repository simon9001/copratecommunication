import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/AppError.js';
export class AuthService {
    static async hashPassword(password) {
        const salt = await bcrypt.genSalt(10);
        return bcrypt.hash(password, salt);
    }
    static async comparePassword(password, hash) {
        return bcrypt.compare(password, hash);
    }
    static generateToken(payload) {
        return jwt.sign(payload, env.JWT_SECRET, {
            expiresIn: env.JWT_EXPIRES_IN,
        });
    }
    static verifyToken(token) {
        try {
            return jwt.verify(token, env.JWT_SECRET);
        }
        catch (err) {
            if (err.name === 'TokenExpiredError') {
                throw new UnauthorizedError('Authentication token has expired');
            }
            throw new UnauthorizedError('Invalid authentication token');
        }
    }
}
