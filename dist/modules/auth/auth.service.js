import { AuthService as JWTAuthService } from '../../services/auth.service.js';
import { AuthRepository } from './auth.repository.js';
import { UnauthorizedError } from '../../errors/AppError.js';
export class AuthService {
    static async login(dto) {
        const user = await AuthRepository.findByEmail(dto.email);
        if (!user || !user.IsActive) {
            throw new UnauthorizedError('Invalid email credentials or account is inactive');
        }
        const isPasswordValid = await JWTAuthService.comparePassword(dto.password, user.PasswordHash);
        if (!isPasswordValid) {
            throw new UnauthorizedError('Invalid password credentials');
        }
        await AuthRepository.updateLastLogin(user.UserId);
        const roles = await AuthRepository.getUserRoles(user.UserId);
        const permissions = await AuthRepository.getUserPermissions(user.UserId);
        const token = JWTAuthService.generateToken({
            userId: user.UserId,
            email: user.Email,
            fullName: user.FullName,
            roles,
            permissions,
        });
        return {
            user: {
                userId: user.UserId,
                fullName: user.FullName,
                email: user.Email,
                roles,
                permissions,
            },
            token,
        };
    }
    static async getProfile(userId) {
        const user = await AuthRepository.findById(userId);
        if (!user) {
            throw new UnauthorizedError('Authenticated user record not found');
        }
        const roles = await AuthRepository.getUserRoles(user.UserId);
        const permissions = await AuthRepository.getUserPermissions(user.UserId);
        return {
            userId: user.UserId,
            fullName: user.FullName,
            email: user.Email,
            isActive: user.IsActive,
            lastLoginAt: user.LastLoginAt,
            roles,
            permissions,
        };
    }
}
