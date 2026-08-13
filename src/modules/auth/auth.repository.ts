import { execute, query, queryOne } from '../../db/query.js'
import { ConflictError } from '../../errors/AppError.js'
import type { RegisterUserDto } from './auth.schema.js'

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
    return queryOne<UserRow>('SELECT * FROM Users WHERE Email = @email', [
      { name: 'email', value: email },
    ])
  }

  public static async findById(userId: number): Promise<UserRow | null> {
    return queryOne<UserRow>('SELECT * FROM Users WHERE UserId = @userId', [
      { name: 'userId', value: userId },
    ])
  }

  public static async createUser(dto: RegisterUserDto, passwordHash: string): Promise<UserRow> {
    const existing = await this.findByEmail(dto.email)
    if (existing) {
      throw new ConflictError(`User with email '${dto.email}' already exists`)
    }

    const insertResult = await execute(
      `INSERT INTO Users (FullName, Email, PasswordHash)
       OUTPUT INSERTED.*
       VALUES (@fullName, @email, @passwordHash)`,
      [
        { name: 'fullName', value: dto.fullName },
        { name: 'email', value: dto.email },
        { name: 'passwordHash', value: passwordHash },
      ]
    )

    const user = insertResult.recordset?.[0] as UserRow

    if (dto.roleNames && dto.roleNames.length > 0) {
      for (const roleName of dto.roleNames) {
        const role = await queryOne<{ RoleId: number }>('SELECT RoleId FROM Roles WHERE RoleName = @roleName', [
          { name: 'roleName', value: roleName },
        ])
        if (role) {
          await execute('INSERT INTO UserRoles (UserId, RoleId) VALUES (@userId, @roleId)', [
            { name: 'userId', value: user.UserId },
            { name: 'roleId', value: role.RoleId },
          ])
        }
      }
    }

    return user
  }

  public static async getUserRoles(userId: number): Promise<string[]> {
    const rows = await query<{ RoleName: string }>(
      `SELECT r.RoleName
       FROM Roles r
       INNER JOIN UserRoles ur ON r.RoleId = ur.RoleId
       WHERE ur.UserId = @userId`,
      [{ name: 'userId', value: userId }]
    )
    return rows.map((r) => r.RoleName)
  }

  public static async getUserPermissions(userId: number): Promise<string[]> {
    const rows = await query<{ PermissionCode: string }>(
      `SELECT DISTINCT p.PermissionCode
       FROM Permissions p
       INNER JOIN RolePermissions rp ON p.PermissionId = rp.PermissionId
       INNER JOIN UserRoles ur ON rp.RoleId = ur.RoleId
       WHERE ur.UserId = @userId`,
      [{ name: 'userId', value: userId }]
    )
    return rows.map((r) => r.PermissionCode)
  }

  public static async updateLastLogin(userId: number): Promise<void> {
    await execute('UPDATE Users SET LastLoginAt = SYSUTCDATETIME() WHERE UserId = @userId', [
      { name: 'userId', value: userId },
    ])
  }
}
