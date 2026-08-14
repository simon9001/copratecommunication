import { ErrorCode } from './errorCodes.js';
export class AppError extends Error {
    statusCode;
    errorCode;
    isOperational;
    details;
    timestamp;
    constructor(message, statusCode = 500, errorCode = ErrorCode.INTERNAL_SERVER_ERROR, isOperational = true, details = null) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = isOperational;
        this.details = details;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
}
export class ValidationError extends AppError {
    constructor(message = 'Validation failed', details = null) {
        super(message, 400, ErrorCode.VALIDATION_ERROR, true, details);
    }
}
export class BadRequestError extends AppError {
    constructor(message = 'Bad request', details = null) {
        super(message, 400, ErrorCode.BAD_REQUEST, true, details);
    }
}
export class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required', details = null) {
        super(message, 401, ErrorCode.UNAUTHORIZED, true, details);
    }
}
export class ForbiddenError extends AppError {
    constructor(message = 'Access denied', details = null) {
        super(message, 403, ErrorCode.FORBIDDEN, true, details);
    }
}
export class NotFoundError extends AppError {
    constructor(message = 'Resource not found', details = null) {
        super(message, 404, ErrorCode.NOT_FOUND, true, details);
    }
}
export class ConflictError extends AppError {
    constructor(message = 'Resource conflict', details = null) {
        super(message, 409, ErrorCode.CONFLICT, true, details);
    }
}
export class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', details = null) {
        super(message, 500, ErrorCode.DATABASE_ERROR, false, details);
    }
}
export class InternalServerError extends AppError {
    constructor(message = 'An unexpected server error occurred', details = null) {
        super(message, 500, ErrorCode.INTERNAL_SERVER_ERROR, false, details);
    }
}
