import { execute, query, queryOne } from '../../db/query.js'

export interface UserRow {
  UserId: number
  FullName: string
  Email: string
  PasswordHash: string
  IsActive: boolean
  LastLoginAt: string | null
  CreatedAt: string
  UpdatedAt: string
}

export class AuthRepository {
  public static async findByEmail(email: string): Promise<UserRow | null> {
    return queryOne<UserRow>('SELECT * FROM "Users" WHERE "Email" = @email', [
      { name: 'email', value: email },
    ])
  }

  public static async findById(userId: number): Promise<UserRow | null> {
    return queryOne<UserRow>('SELECT * FROM "Users" WHERE "UserId" = @userId', [
      { name: 'userId', value: userId },
    ])
  }

  public static async getUserRoles(userId: number): Promise<string[]> {
    const rows = await query<{ RoleName: string }>(
      `SELECT r."RoleName"
       FROM "Roles" r
       INNER JOIN "UserRoles" ur ON r."RoleId" = ur."RoleId"
       WHERE ur."UserId" = @userId`,
      [{ name: 'userId', value: userId }]
    )
    return rows.map((r) => r.RoleName)
  }

  public static async getUserPermissions(userId: number): Promise<string[]> {
    const rows = await query<{ PermissionCode: string }>(
      `SELECT DISTINCT p."PermissionCode"
       FROM "Permissions" p
       INNER JOIN "RolePermissions" rp ON p."PermissionId" = rp."PermissionId"
       INNER JOIN "UserRoles" ur ON rp."RoleId" = ur."RoleId"
       WHERE ur."UserId" = @userId`,
      [{ name: 'userId', value: userId }]
    )
    return rows.map((r) => r.PermissionCode)
  }

  public static async updateLastLogin(userId: number): Promise<void> {
    await execute('UPDATE "Users" SET "LastLoginAt" = NOW() WHERE "UserId" = @userId', [
      { name: 'userId', value: userId },
    ])
  }
}
