import type { Context } from 'hono'
import { AuthService } from './auth.service.js'
import { createSuccessResponse } from '../../errors/errorResponse.js'
import type { RegisterUserDto, LoginUserDto } from './auth.schema.js'

export class AuthController {
  public static async register(c: Context) {
    const body = c.get('validatedBody') as RegisterUserDto
    const result = await AuthService.register(body)

    return c.json(
      createSuccessResponse(result, 'User account registered successfully', undefined, c.get('requestId') as string | undefined),
      201
    )
  }

  public static async login(c: Context) {
    const body = c.get('validatedBody') as LoginUserDto
    const result = await AuthService.login(body)

    return c.json(
      createSuccessResponse(result, 'Authentication successful', undefined, c.get('requestId') as string | undefined)
    )
  }

  public static async me(c: Context) {
    const userPayload = c.get('user')
    const profile = await AuthService.getProfile(userPayload.userId)

    return c.json(
      createSuccessResponse(profile, 'Current user profile retrieved', undefined, c.get('requestId') as string | undefined)
    )
  }
}
