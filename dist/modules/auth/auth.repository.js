import { execute, query, queryOne } from '../../db/query.js';
export class AuthRepository {
    static async findByEmail(email) {
        return queryOne('SELECT * FROM "Users" WHERE "Email" = @email', [
            { name: 'email', value: email },
        ]);
    }
    static async findById(userId) {
        return queryOne('SELECT * FROM "Users" WHERE "UserId" = @userId', [
            { name: 'userId', value: userId },
        ]);
    }
    static async getUserRoles(userId) {
        const rows = await query(`SELECT r."RoleName"
       FROM "Roles" r
       INNER JOIN "UserRoles" ur ON r."RoleId" = ur."RoleId"
       WHERE ur."UserId" = @userId`, [{ name: 'userId', value: userId }]);
        return rows.map((r) => r.RoleName);
    }
    static async getUserPermissions(userId) {
        const rows = await query(`SELECT DISTINCT p."PermissionCode"
       FROM "Permissions" p
       INNER JOIN "RolePermissions" rp ON p."PermissionId" = rp."PermissionId"
       INNER JOIN "UserRoles" ur ON rp."RoleId" = ur."RoleId"
       WHERE ur."UserId" = @userId`, [{ name: 'userId', value: userId }]);
        return rows.map((r) => r.PermissionCode);
    }
    static async updateLastLogin(userId) {
        await execute('UPDATE "Users" SET "LastLoginAt" = NOW() WHERE "UserId" = @userId', [
            { name: 'userId', value: userId },
        ]);
    }
}
