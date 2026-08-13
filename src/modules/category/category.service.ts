import { CategoryRepository } from './category.repository.js'

export class CategoryService {
  public static async listCategories() {
    return CategoryRepository.findAll()
  }

  public static async createCategory(categoryName: string, description?: string, iconName?: string) {
    return CategoryRepository.create(categoryName, description, iconName)
  }
}
