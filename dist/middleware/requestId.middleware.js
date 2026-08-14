import { createMiddleware } from 'hono/factory';
import { randomUUID } from 'crypto';
export const requestIdMiddleware = createMiddleware(async (c, next) => {
    const existingId = c.req.header('x-request-id');
    const requestId = existingId || randomUUID();
    c.set('requestId', requestId);
    c.header('x-request-id', requestId);
    await next();
});
