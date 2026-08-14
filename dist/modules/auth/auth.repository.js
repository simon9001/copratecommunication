import { execute, query, queryOne } from '../../db/query.js';
import { ConflictError } from '../../errors/AppError.js';
export class AuthRepository {
    static async findByEmail(email) {
        return queryOne('SELECT * FROM Users WHERE Email = @email', [
            { name: 'email', value: email },
        ]);
    }
    static async findById(userId) {
        return queryOne('SELECT * FROM Users WHERE UserId = @userId', [
            { name: 'userId', value: userId },
        ]);
    }
    static async createUser(dto, passwordHash) {
        const existing = await this.findByEmail(dto.email);
        if (existing) {
            throw new ConflictError(`User with email '${dto.email}' already exists`);
        }
        const insertResult = await execute(`INSERT INTO Users (FullName, Email, PasswordHash)
       OUTPUT INSERTED.*
       VALUES (@fullName, @email, @passwordHash)`, [
            { name: 'fullName', value: dto.fullName },
            { name: 'email', value: dto.email },
            { name: 'passwordHash', value: passwordHash },
        ]);
        const user = insertResult.recordset?.[0];
        if (dto.roleNames && dto.roleNames.length > 0) {
            for (const roleName of dto.roleNames) {
                const role = await queryOne('SELECT RoleId FROM Roles WHERE RoleName = @roleName', [
                    { name: 'roleName', value: roleName },
                ]);
                if (role) {
                    await execute('INSERT INTO UserRoles (UserId, RoleId) VALUES (@userId, @roleId)', [
                        { name: 'userId', value: user.UserId },
                        { name: 'roleId', value: role.RoleId },
                    ]);
                }
            }
        }
        return user;
    }
    static async getUserRoles(userId) {
        const rows = await query(`SELECT r.RoleName
       FROM Roles r
       INNER JOIN UserRoles ur ON r.RoleId = ur.RoleId
       WHERE ur.UserId = @userId`, [{ name: 'userId', value: userId }]);
        return rows.map((r) => r.RoleName);
    }
    static async getUserPermissions(userId) {
        const rows = await query(`SELECT DISTINCT p.PermissionCode
       FROM Permissions p
       INNER JOIN RolePermissions rp ON p.PermissionId = rp.PermissionId
       INNER JOIN UserRoles ur ON rp.RoleId = ur.RoleId
       WHERE ur.UserId = @userId`, [{ name: 'userId', value: userId }]);
        return rows.map((r) => r.PermissionCode);
    }
    static async updateLastLogin(userId) {
        await execute('UPDATE Users SET LastLoginAt = SYSUTCDATETIME() WHERE UserId = @userId', [
            { name: 'userId', value: userId },
        ]);
    }
}
