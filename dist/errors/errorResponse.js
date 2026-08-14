import { ErrorCode } from './errorCodes.js';
export function createErrorResponse(message, code = ErrorCode.INTERNAL_SERVER_ERROR, details = null, requestId) {
    return {
        success: false,
        error: {
            code,
            message,
            ...(details ? { details } : {}),
            timestamp: new Date().toISOString(),
            ...(requestId ? { requestId } : {}),
        },
    };
}
export function createSuccessResponse(data, message, meta, requestId) {
    return {
        success: true,
        data,
        ...(message ? { message } : {}),
        ...(meta ? { meta } : {}),
        ...(requestId ? { requestId } : {}),
    };
}
