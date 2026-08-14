import { execute, query, queryOne } from '../../db/query.js';
import { ConflictError } from '../../errors/AppError.js';
export class CategoryRepository {
    static async findAll() {
        return query('SELECT * FROM ProjectCategories WHERE IsActive = 1 ORDER BY CategoryName ASC');
    }
    static async findById(categoryId) {
        return queryOne('SELECT * FROM ProjectCategories WHERE CategoryId = @id', [{ name: 'id', value: categoryId }]);
    }
    static async create(categoryName, description, iconName) {
        const existing = await queryOne('SELECT 1 FROM ProjectCategories WHERE CategoryName = @name', [{ name: 'name', value: categoryName }]);
        if (existing) {
            throw new ConflictError(`Category '${categoryName}' already exists`);
        }
        const res = await execute(`INSERT INTO ProjectCategories (CategoryName, Description, IconName)
       OUTPUT INSERTED.*
       VALUES (@categoryName, @description, @iconName)`, [
            { name: 'categoryName', value: categoryName },
            { name: 'description', value: description || null },
            { name: 'iconName', value: iconName || null },
        ]);
        return res.recordset?.[0];
    }
}
