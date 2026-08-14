import { z } from 'zod';
export function validateBody(schema) {
    return async (c, next) => {
        const body = await c.req.json().catch(() => ({}));
        const parsed = await schema.parseAsync(body);
        c.set('validatedBody', parsed);
        await next();
    };
}
export function validateQuery(schema) {
    return async (c, next) => {
        const queryParams = c.req.query();
        const parsed = await schema.parseAsync(queryParams);
        c.set('validatedQuery', parsed);
        await next();
    };
}
export function validateParam(schema) {
    return async (c, next) => {
        const params = c.req.param();
        const parsed = await schema.parseAsync(params);
        c.set('validatedParam', parsed);
        await next();
    };
}
