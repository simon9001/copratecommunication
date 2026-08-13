import type { NotFoundHandler } from 'hono'
import { ErrorCode } from '../errors/errorCodes.js'
import { createErrorResponse } from '../errors/errorResponse.js'

export const notFoundHandler: NotFoundHandler = (c) => {
  const requestId = c.get('requestId')
  const path = c.req.path
  const method = c.req.method

  return c.json(
    createErrorResponse(`Route '${method} ${path}' not found`, ErrorCode.NOT_FOUND, null, requestId),
    404
  )
}
