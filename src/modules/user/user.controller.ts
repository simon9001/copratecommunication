import type { Context } from 'hono'
import { UserService } from './user.service.js'
import { createSuccessResponse } from '../../errors/errorResponse.js'
import type { RegisterUserDto } from '../auth/auth.schema.js'

export class UserController {
  public static async listUsers(c: Context) {
    const users = await UserService.listUsers()
    return c.json(createSuccessResponse(users, 'Users list retrieved', undefined, c.get('requestId') as string | undefined))
  }

  public static async createUser(c: Context) {
    const body = c.get('validatedBody') as RegisterUserDto
    const result = await UserService.createUser(body)
    return c.json(createSuccessResponse(result, 'User account created successfully', undefined, c.get('requestId') as string | undefined), 201)
  }

  public static async toggleStatus(c: Context) {
    const paramId = c.req.param('id') || ''
    const userId = parseInt(paramId, 10)
    const body = await c.req.json().catch(() => ({}))
    const isActive = Boolean(body.isActive)
    await UserService.toggleUserStatus(userId, isActive)
    return c.json(createSuccessResponse(null, `User status updated to ${isActive ? 'active' : 'inactive'}`, undefined, c.get('requestId') as string | undefined))
  }

  public static async deleteUser(c: Context) {
    const paramId = c.req.param('id') || ''
    const userId = parseInt(paramId, 10)
    await UserService.deleteUser(userId)
    return c.json(createSuccessResponse(null, 'User account deleted successfully', undefined, c.get('requestId') as string | undefined))
  }
}
