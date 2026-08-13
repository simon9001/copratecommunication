import type { Context } from 'hono'
import { CategoryService } from './category.service.js'
import { createSuccessResponse } from '../../errors/errorResponse.js'

export interface CreateCategoryBody {
  categoryName: string
  description?: string
  iconName?: string
}

export class CategoryController {
  public static async listCategories(c: Context) {
    const categories = await CategoryService.listCategories()
    return c.json(
      createSuccessResponse(categories, 'Categories list retrieved', undefined, c.get('requestId') as string | undefined)
    )
  }

  public static async createCategory(c: Context) {
    const body = c.get('validatedBody') as CreateCategoryBody
    const category = await CategoryService.createCategory(body.categoryName, body.description, body.iconName)
    return c.json(
      createSuccessResponse(category, 'Category created', undefined, c.get('requestId') as string | undefined),
      201
    )
  }
}
