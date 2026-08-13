import type { Context, Next } from 'hono'
import { z } from 'zod'

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = await schema.parseAsync(body)
    c.set('validatedBody', parsed)
    await next()
  }
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    const queryParams = c.req.query()
    const parsed = await schema.parseAsync(queryParams)
    c.set('validatedQuery', parsed)
    await next()
  }
}

export function validateParam<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    const params = c.req.param()
    const parsed = await schema.parseAsync(params)
    c.set('validatedParam', parsed)
    await next()
  }
}
