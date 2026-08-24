import { Hono } from 'hono';
import { MediaController } from './media.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireEditor } from '../../middleware/permission.middleware.js';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate.middleware.js';
import { createMediaSchema, updateMediaSchema } from './media.schema.js';
export const mediaRouter = new Hono();
const uploadServerFileSchema = z.object({
    projectId: z.number().int(),
    mediaType: z.enum(['VIDEO', 'IMAGE', '360_VIDEO', '360_IMAGE', 'MODEL_3D']),
    title: z.string().max(250).optional(),
    description: z.string().max(1000).optional(),
    fileData: z.string().min(1, 'Base64/URL data string required'),
    isFeatured: z.boolean().default(false),
});
mediaRouter.get('/', MediaController.listAllMedia);
mediaRouter.post('/', authMiddleware, requireEditor, validateBody(createMediaSchema), MediaController.createMedia);
mediaRouter.put('/:mediaId', authMiddleware, requireEditor, validateBody(updateMediaSchema), MediaController.updateMedia);
mediaRouter.patch('/:mediaId', authMiddleware, requireEditor, validateBody(updateMediaSchema), MediaController.updateMedia);
mediaRouter.delete('/:mediaId', authMiddleware, requireEditor, MediaController.deleteMedia);
mediaRouter.get('/signature', authMiddleware, requireEditor, MediaController.getUploadSignature);
mediaRouter.post('/upload', authMiddleware, requireEditor, validateBody(uploadServerFileSchema), MediaController.uploadToCloudinary);
