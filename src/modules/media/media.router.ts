import { Hono } from 'hono'
import { MediaController } from './media.controller.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { requirePermission } from '../../middleware/permission.middleware.js'
import { z } from 'zod'
import { validateBody } from '../../middleware/validate.middleware.js'
import type { AppEnv } from '../../types/hono.js'

export const mediaRouter = new Hono<AppEnv>()

const uploadServerFileSchema = z.object({
  projectId: z.number().int(),
  mediaType: z.enum(['VIDEO', 'IMAGE', '360_VIDEO', '360_IMAGE', 'MODEL_3D']),
  title: z.string().max(250).optional(),
  description: z.string().max(1000).optional(),
  fileData: z.string().min(1, 'Base64/URL data string required'),
  isFeatured: z.boolean().default(false),
})

mediaRouter.get('/signature', authMiddleware, requirePermission('MEDIA_UPLOAD'), MediaController.getUploadSignature)
mediaRouter.post('/upload', authMiddleware, requirePermission('MEDIA_UPLOAD'), validateBody(uploadServerFileSchema), MediaController.uploadToCloudinary)
