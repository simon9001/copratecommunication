import { execute, query, queryOne } from '../../db/query.js';
import { NotFoundError } from '../../errors/AppError.js';
export class UserRepository {
    static async findAll() {
        const rows = await query(`
      SELECT
        u.UserId,
        u.FullName,
        u.Email,
        u.IsActive,
        u.LastLoginAt,
        u.CreatedAt,
        u.UpdatedAt,
        STRING_AGG(r.RoleName, ', ') AS RoleNames
      FROM Users u
      LEFT JOIN UserRoles ur ON u.UserId = ur.UserId
      LEFT JOIN Roles r ON ur.RoleId = r.RoleId
      GROUP BY u.UserId, u.FullName, u.Email, u.IsActive, u.LastLoginAt, u.CreatedAt, u.UpdatedAt
      ORDER BY u.CreatedAt DESC
    `);
        return rows.map((r) => ({
            UserId: r.UserId,
            FullName: r.FullName,
            Email: r.Email,
            IsActive: r.IsActive,
            LastLoginAt: r.LastLoginAt,
            CreatedAt: r.CreatedAt,
            UpdatedAt: r.UpdatedAt,
            Roles: r.RoleNames ? r.RoleNames.split(', ') : [],
        }));
    }
    static async toggleStatus(userId, isActive) {
        const user = await queryOne('SELECT UserId FROM Users WHERE UserId = @userId', [{ name: 'userId', value: userId }]);
        if (!user) {
            throw new NotFoundError(`User with ID ${userId} not found`);
        }
        await execute('UPDATE Users SET IsActive = @isActive, UpdatedAt = SYSUTCDATETIME() WHERE UserId = @userId', [
            { name: 'userId', value: userId },
            { name: 'isActive', value: isActive ? 1 : 0 },
        ]);
    }
    static async delete(userId) {
        const user = await queryOne('SELECT UserId FROM Users WHERE UserId = @userId', [{ name: 'userId', value: userId }]);
        if (!user) {
            throw new NotFoundError(`User with ID ${userId} not found`);
        }
        await execute('DELETE FROM Users WHERE UserId = @userId', [{ name: 'userId', value: userId }]);
    }
}
