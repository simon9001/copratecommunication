import { ErrorCode } from './errorCodes.js'

export class AppError extends Error {
  public readonly statusCode: number
  public readonly errorCode: ErrorCode
  public readonly isOperational: boolean
  public readonly details: unknown
  public readonly timestamp: string

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    isOperational: boolean = true,
    details: unknown = null
  ) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.errorCode = errorCode
    this.isOperational = isOperational
    this.details = details
    this.timestamp = new Date().toISOString()
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details: unknown = null) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, true, details)
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details: unknown = null) {
    super(message, 400, ErrorCode.BAD_REQUEST, true, details)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required', details: unknown = null) {
    super(message, 401, ErrorCode.UNAUTHORIZED, true, details)
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied', details: unknown = null) {
    super(message, 403, ErrorCode.FORBIDDEN, true, details)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details: unknown = null) {
    super(message, 404, ErrorCode.NOT_FOUND, true, details)
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details: unknown = null) {
    super(message, 409, ErrorCode.CONFLICT, true, details)
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details: unknown = null) {
    super(message, 500, ErrorCode.DATABASE_ERROR, false, details)
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'An unexpected server error occurred', details: unknown = null) {
    super(message, 500, ErrorCode.INTERNAL_SERVER_ERROR, false, details)
  }
}
