import { createMiddleware } from 'hono/factory';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError.js';
export function requirePermission(requiredPermission) {
    return createMiddleware(async (c, next) => {
        const user = c.get('user');
        if (!user) {
            throw new UnauthorizedError('User authentication required');
        }
        // Super Administrator bypasses individual permission checks
        if (user.roles.includes('Super Administrator')) {
            return await next();
        }
        if (!user.permissions || !user.permissions.includes(requiredPermission)) {
            throw new ForbiddenError(`Permission denied: Requires '${requiredPermission}' permission to access this resource`);
        }
        await next();
    });
}
export function requireRole(requiredRole) {
    return createMiddleware(async (c, next) => {
        const user = c.get('user');
        if (!user) {
            throw new UnauthorizedError('User authentication required');
        }
        if (user.roles.includes('Super Administrator')) {
            return await next();
        }
        if (!user.roles || !user.roles.includes(requiredRole)) {
            throw new ForbiddenError(`Permission denied: Requires '${requiredRole}' role`);
        }
        await next();
    });
}
