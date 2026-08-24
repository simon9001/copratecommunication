import type { Context, ErrorHandler } from 'hono'
import { ZodError } from 'zod'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'
import { createErrorResponse } from '../errors/errorResponse.js'
import { alertService } from '../services/alert.service.js'
import { logger } from '../services/logger.service.js'

export const errorHandler: ErrorHandler = (err: Error, c: Context) => {
  const requestId = c.get('requestId') || 'N/A'

  // 1. Custom Application Errors (AppError & derived classes)
  if (err instanceof AppError) {
    if (!err.isOperational || err.statusCode >= 500) {
      logger.error(`[AppError ${err.statusCode}] ${err.message} [ReqID: ${requestId}]`, err.stack)
      alertService.triggerAlert({
        severity: 'CRITICAL',
        title: `Operational Server Error (${err.errorCode})`,
        message: err.message,
        details: { stack: err.stack, details: err.details },
        requestId,
      })
    } else {
      logger.warn(`[AppError ${err.statusCode}] ${err.message} [ReqID: ${requestId}]`)
    }

    return c.json(
      createErrorResponse(err.message, err.errorCode, err.details, requestId),
      err.statusCode as any
    )
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    logger.warn(`[Validation Error] Input validation failed [ReqID: ${requestId}]`, err.issues)
    const formattedDetails = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }))

    return c.json(
      createErrorResponse('Validation error: invalid request payload', ErrorCode.VALIDATION_ERROR, formattedDetails, requestId),
      400
    )
  }

  // 3. PostgreSQL driver errors
  //
  // node-postgres reports failures as SQLSTATE codes. A constraint the
  // caller can actually do something about is a 4xx, not a 500 — a
  // duplicate project code is the client's problem to fix, whereas a
  // dropped connection is ours.
  const pgCode = (err as any).code
  if (typeof pgCode === 'string' && /^[0-9A-Z]{5}$/.test(pgCode)) {
    const constraint = (err as any).constraint as string | undefined
    const detail = (err as any).detail as string | undefined

    switch (pgCode) {
      case '23505': // unique_violation
        logger.warn(`[Database Conflict] Unique constraint '${constraint}' [ReqID: ${requestId}]`)
        return c.json(
          createErrorResponse(
            'That record already exists. Check for a duplicate code, slug, or name.',
            ErrorCode.CONFLICT,
            detail ? { detail } : null,
            requestId
          ),
          409
        )

      case '23503': // foreign_key_violation
        logger.warn(`[Database Conflict] Foreign key '${constraint}' [ReqID: ${requestId}]`)
        return c.json(
          createErrorResponse(
            'That referenced record does not exist, or is still in use elsewhere.',
            ErrorCode.CONSTRAINT_VIOLATION,
            detail ? { detail } : null,
            requestId
          ),
          409
        )

      case '23502': // not_null_violation
      case '23514': // check_violation
        logger.warn(`[Database Constraint] '${constraint}' rejected the value [ReqID: ${requestId}]`)
        return c.json(
          createErrorResponse(
            'A required value is missing or outside the allowed range.',
            ErrorCode.VALIDATION_ERROR,
            detail ? { detail } : null,
            requestId
          ),
          400
        )

      case '42P01': // undefined_table
        logger.error(`[Schema Missing] ${err.message} [ReqID: ${requestId}]`)
        alertService.triggerAlert({
          severity: 'FATAL',
          title: 'Database Schema Missing',
          message: 'A required table does not exist. Has supabase/schema.sql been run?',
          details: { code: pgCode, originalError: err.message },
          requestId,
        })
        return c.json(
          createErrorResponse(
            'The database schema is not initialised.',
            ErrorCode.DATABASE_ERROR,
            null,
            requestId
          ),
          500
        )

      default:
        logger.error(`[Database Exception] Postgres error ${pgCode} [ReqID: ${requestId}]`, err)
        alertService.triggerAlert({
          severity: 'CRITICAL',
          title: `Postgres Error ${pgCode}`,
          message: err.message,
          details: { code: pgCode, constraint, originalError: err.message },
          requestId,
        })
        return c.json(
          createErrorResponse(
            'Database operation failed due to a server constraint or error',
            ErrorCode.DATABASE_ERROR,
            null,
            requestId
          ),
          500
        )
    }
  }

  // 4. Unhandled 500 Internal Server Errors
  logger.error(`[Unhandled Exception] Uncaught error: ${err.message} [ReqID: ${requestId}]`, err.stack)
  
  alertService.triggerAlert({
    severity: 'FATAL',
    title: 'Unhandled Internal Server Error',
    message: err.message,
    details: { name: err.name, stack: err.stack },
    requestId,
  })

  return c.json(
    createErrorResponse('An unexpected internal server error occurred', ErrorCode.INTERNAL_SERVER_ERROR, null, requestId),
    500
  )
}
