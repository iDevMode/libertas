import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../../auth/index.js';
import type { UserPayload } from '../../common/types.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserPayload;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      },
    });
    return;
  }

  const token = authHeader.substring(7);
  const user = await authService.validateToken(token);

  if (!user) {
    reply.status(401).send({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    });
    return;
  }

  request.user = user;
}

export function requireTier(minTier: 'community' | 'pro' | 'enterprise') {
  const tierLevels = { community: 0, pro: 1, enterprise: 2 };

  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    if (!request.user) {
      reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (tierLevels[request.user.tier] < tierLevels[minTier]) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `This feature requires ${minTier} subscription or higher`,
        },
      });
      return;
    }
  };
}
