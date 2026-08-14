import { UserRepository } from './user.repository.js'
import { AuthService } from '../auth/auth.service.js'
import type { RegisterUserDto } from '../auth/auth.schema.js'

export class UserService {
  public static async listUsers() {
    return UserRepository.findAll()
  }

  public static async createUser(dto: RegisterUserDto) {
    return AuthService.register(dto)
  }

  public static async toggleUserStatus(userId: number, isActive: boolean) {
    return UserRepository.toggleStatus(userId, isActive)
  }

  public static async deleteUser(userId: number) {
    return UserRepository.delete(userId)
  }
}
