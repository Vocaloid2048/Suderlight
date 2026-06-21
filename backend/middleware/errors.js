/**
 * 类型化错误层次 —— 替代裸 throw new Error('...')
 */

class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {string} code
   * @param {boolean} [isOperational=true]
   */
  constructor(message, statusCode, code, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.status = statusCode;
    this.code = code || 'APP_ERROR';
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} not found: ${id}`, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  /**
   * @param {string} message
   * @param {Array<{field: string, message: string}>} [errors]
   */
  constructor(message, errors = []) {
    super(message, 422, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}

class ExternalServiceError extends AppError {
  constructor(service, detail = '') {
    super(`External service error: ${service}${detail ? ` — ${detail}` : ''}`, 502, 'EXTERNAL_SERVICE');
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ExternalServiceError,
};
