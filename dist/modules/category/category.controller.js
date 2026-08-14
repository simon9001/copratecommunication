import { CategoryService } from './category.service.js';
import { createSuccessResponse } from '../../errors/errorResponse.js';
export class CategoryController {
    static async listCategories(c) {
        const categories = await CategoryService.listCategories();
        return c.json(createSuccessResponse(categories, 'Categories list retrieved', undefined, c.get('requestId')));
    }
    static async createCategory(c) {
        const body = c.get('validatedBody');
        const category = await CategoryService.createCategory(body.categoryName, body.description, body.iconName);
        return c.json(createSuccessResponse(category, 'Category created', undefined, c.get('requestId')), 201);
    }
}
