import { ErrorCode } from './errorCodes.js'

export interface ApiErrorEnvelope {
  success: false
  error: {
    code: ErrorCode | string
    message: string
    details?: unknown
    timestamp: string
    requestId?: string
  }
}

export function createErrorResponse(
  message: string,
  code: ErrorCode | string = ErrorCode.INTERNAL_SERVER_ERROR,
  details: unknown = null,
  requestId?: string | null
): ApiErrorEnvelope {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
    },
  }
}

export interface ApiSuccessEnvelope<T> {
  success: true
  data: T
  message?: string
  meta?: Record<string, unknown>
  requestId?: string
}

export function createSuccessResponse<T>(
  data: T,
  message?: string,
  meta?: Record<string, unknown> | null,
  requestId?: string | null
): ApiSuccessEnvelope<T> {
  return {
    success: true,
    data,
    ...(message ? { message } : {}),
    ...(meta ? { meta } : {}),
    ...(requestId ? { requestId } : {}),
  }
}
