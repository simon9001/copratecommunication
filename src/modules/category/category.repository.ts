import { execute, query, queryOne } from '../../db/query.js'
import { ConflictError } from '../../errors/AppError.js'

export interface CategoryRow {
  CategoryId: number
  CategoryName: string
  Description: string | null
  IconName: string | null
  IsActive: boolean
  CreatedAt: string
}

export class CategoryRepository {
  public static async findAll(): Promise<CategoryRow[]> {
    return query<CategoryRow>('SELECT * FROM "ProjectCategories" WHERE "IsActive" = TRUE ORDER BY "CategoryName" ASC')
  }

  public static async findById(categoryId: number): Promise<CategoryRow | null> {
    return queryOne<CategoryRow>('SELECT * FROM "ProjectCategories" WHERE "CategoryId" = @id', [
      { name: 'id', value: categoryId },
    ])
  }

  public static async create(categoryName: string, description?: string, iconName?: string): Promise<CategoryRow> {
    const existing = await queryOne('SELECT 1 FROM "ProjectCategories" WHERE "CategoryName" = @name', [
      { name: 'name', value: categoryName },
    ])
    if (existing) {
      throw new ConflictError(`Category '${categoryName}' already exists`)
    }

    const res = await execute(
      `INSERT INTO "ProjectCategories" ("CategoryName", "Description", "IconName")
       VALUES (@categoryName, @description, @iconName)
       RETURNING *`,
      [
        { name: 'categoryName', value: categoryName },
        { name: 'description', value: description || null },
        { name: 'iconName', value: iconName || null },
      ]
    )

    return res.recordset?.[0] as CategoryRow
  }
}
