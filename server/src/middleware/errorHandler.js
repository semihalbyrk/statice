const AppError = require('./AppError');

function errorHandler(err, req, res, _next) {
  // AppError (custom application errors)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.code && { code: err.code }),
    });
  }

  // Prisma known errors
  if (err.code === 'P2002') {
    console.error('Unique constraint violation:', err.meta);
    return res.status(409).json({ error: 'A record with this value already exists', field: err.meta?.target });
  }
  if (err.code === 'P2003') {
    console.error('Foreign key constraint failed:', err.meta);
    return res.status(400).json({ error: 'Referenced record not found', field: err.meta?.field_name });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  if (err.code === 'P2006') {
    console.error('Invalid value for field:', err.meta);
    return res.status(400).json({ error: 'Invalid value provided', field: err.meta?.field_name });
  }

  // JWT errors
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Fallback
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    error: err.statusCode ? err.message : 'Internal server error',
  });
}

module.exports = errorHandler;
