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

  // 3. MSSQL Database Exception Fallback
  if ((err as any).name === 'RequestError' || (err as any).code === 'EREQUEST' || (err as any).code === 'ELOGIN') {
    logger.error(`[Database Exception] SQL Server Driver Error [ReqID: ${requestId}]`, err)
    alertService.triggerAlert({
      severity: 'CRITICAL',
      title: 'SQL Server Request Exception',
      message: err.message,
      details: { code: (err as any).code, originalError: err },
      requestId,
    })

    return c.json(
      createErrorResponse('Database operation failed due to a server constraint or error', ErrorCode.DATABASE_ERROR, null, requestId),
      500
    )
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
