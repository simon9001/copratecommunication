import { createMiddleware } from 'hono/factory';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError.js';
import { EDITOR_ROLE } from '../db/seed.js';
/**
 * The system has a single authenticated role: Editor.
 *
 * Anything that is not public is Editor-only, so authorisation is one
 * question — "is this the Editor?" — rather than a permission matrix.
 * The previous implementation granted a blanket bypass to any role whose
 * name merely *contained* "admin", "super" or "manager", which is exactly
 * the kind of check that quietly becomes a hole. This is an exact match.
 */
export const requireEditor = createMiddleware(async (c, next) => {
    const user = c.get('user');
    if (!user) {
        throw new UnauthorizedError('User authentication required');
    }
    const isEditor = Array.isArray(user.roles) && user.roles.includes(EDITOR_ROLE);
    if (!isEditor) {
        throw new ForbiddenError('This action is restricted to the KeNHA Editor account');
    }
    await next();
});
