import { UserRepository } from './user.repository.js';
import { AuthService } from '../auth/auth.service.js';
export class UserService {
    static async listUsers() {
        return UserRepository.findAll();
    }
    static async createUser(dto) {
        return AuthService.register(dto);
    }
    static async toggleUserStatus(userId, isActive) {
        return UserRepository.toggleStatus(userId, isActive);
    }
    static async deleteUser(userId) {
        return UserRepository.delete(userId);
    }
}
