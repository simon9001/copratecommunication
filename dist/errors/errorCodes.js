export var ErrorCode;
(function (ErrorCode) {
    // Client Errors (4xx)
    ErrorCode["BAD_REQUEST"] = "BAD_REQUEST";
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["CONFLICT"] = "CONFLICT";
    ErrorCode["UNPROCESSABLE_ENTITY"] = "UNPROCESSABLE_ENTITY";
    ErrorCode["TOO_MANY_REQUESTS"] = "TOO_MANY_REQUESTS";
    // Database Errors (5xx)
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["DATABASE_CONNECTION_ERROR"] = "DATABASE_CONNECTION_ERROR";
    ErrorCode["CONSTRAINT_VIOLATION"] = "CONSTRAINT_VIOLATION";
    // Server & System Errors (5xx)
    ErrorCode["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    ErrorCode["NOT_IMPLEMENTED"] = "NOT_IMPLEMENTED";
})(ErrorCode || (ErrorCode = {}));
