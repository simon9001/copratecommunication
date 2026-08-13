import { createMiddleware } from 'hono/factory'
import { AuthService } from '../services/auth.service.js'
import type { JwtPayload } from '../services/auth.service.js'
import { UnauthorizedError } from '../errors/AppError.js'

export const authMiddleware = createMiddleware<{
  Variables: {
    user: JwtPayload
    requestId: string
  }
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header. Token format: Bearer <token>')
  }

  const token = authHeader.split(' ')[1]
  const user = AuthService.verifyToken(token)

  c.set('user', user)
  await next()
})
