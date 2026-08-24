import { Hono } from 'hono';
import { CategoryController } from './category.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireEditor } from '../../middleware/permission.middleware.js';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate.middleware.js';
export const categoryRouter = new Hono();
const createCategorySchema = z.object({
    categoryName: z.string().min(2).max(150),
    description: z.string().max(500).optional(),
    iconName: z.string().max(100).optional(),
});
categoryRouter.get('/', CategoryController.listCategories);
categoryRouter.post('/', authMiddleware, requireEditor, validateBody(createCategorySchema), CategoryController.createCategory);
