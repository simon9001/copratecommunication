import { Hono } from 'hono'
import { UserController } from './user.controller.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { requirePermission } from '../../middleware/permission.middleware.js'
import { validateBody } from '../../middleware/validate.middleware.js'
import { registerUserSchema } from '../auth/auth.schema.js'
import type { AppEnv } from '../../types/hono.js'

export const userRouter = new Hono<AppEnv>()

userRouter.get('/', authMiddleware, requirePermission('USER_MANAGE'), UserController.listUsers)
userRouter.post('/', authMiddleware, requirePermission('USER_MANAGE'), validateBody(registerUserSchema), UserController.createUser)
userRouter.patch('/:id/status', authMiddleware, requirePermission('USER_MANAGE'), UserController.toggleStatus)
userRouter.delete('/:id', authMiddleware, requirePermission('USER_MANAGE'), UserController.deleteUser)
