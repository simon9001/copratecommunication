import { createMiddleware } from 'hono/factory';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError.js';
export function requirePermission(requiredPermission) {
    return createMiddleware(async (c, next) => {
        const user = c.get('user');
        if (!user) {
            throw new UnauthorizedError('User authentication required');
        }
        const isAdmin = user.roles &&
            user.roles.some((r) => {
                const lower = (r || '').toLowerCase();
                return (lower.includes('admin') ||
                    lower.includes('super') ||
                    lower.includes('manager'));
            });
        // Super Administrator and Admin/Manager roles bypass individual permission checks
        if (isAdmin) {
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
        const isAdmin = user.roles &&
            user.roles.some((r) => {
                const lower = (r || '').toLowerCase();
                return (lower.includes('admin') ||
                    lower.includes('super') ||
                    lower.includes('manager'));
            });
        if (isAdmin) {
            return await next();
        }
        if (!user.roles || !user.roles.includes(requiredRole)) {
            throw new ForbiddenError(`Permission denied: Requires '${requiredRole}' role`);
        }
        await next();
    });
}
