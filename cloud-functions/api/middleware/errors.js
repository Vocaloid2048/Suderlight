/**
 * 类型化错误层次 —— 替代裸 throw new Error('...')
 */
class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(message) { super(message, 400, 'VALIDATION_ERROR'); }
}

class NotFoundError extends AppError {
  constructor(type, id) { super(`${type} not found: ${id}`, 404, 'NOT_FOUND'); }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(message, 401, 'UNAUTHORIZED'); }
}

export { AppError, ValidationError, NotFoundError, UnauthorizedError };
