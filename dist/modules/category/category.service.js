import { CategoryRepository } from './category.repository.js';
export class CategoryService {
    static async listCategories() {
        return CategoryRepository.findAll();
    }
    static async createCategory(categoryName, description, iconName) {
        return CategoryRepository.create(categoryName, description, iconName);
    }
}
