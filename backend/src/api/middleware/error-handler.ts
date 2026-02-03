import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../../common/logger.js';
import { ApiResponse } from '../../common/types.js';

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  logger.error({ error: error.message, stack: error.stack }, 'Request error');

  const statusCode = error.statusCode || 500;

  const response: ApiResponse<null> = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'An unexpected error occurred' : error.message,
    },
  };

  reply.status(statusCode).send(response);
}
