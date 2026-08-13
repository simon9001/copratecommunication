import { Hono } from 'hono'
import { AuthController } from './auth.controller.js'
import { loginUserSchema, registerUserSchema } from './auth.schema.js'
import { validateBody } from '../../middleware/validate.middleware.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import type { AppEnv } from '../../types/hono.js'

export const authRouter = new Hono<AppEnv>()

authRouter.post('/register', validateBody(registerUserSchema), AuthController.register)
authRouter.post('/login', validateBody(loginUserSchema), AuthController.login)
authRouter.get('/me', authMiddleware, AuthController.me)
