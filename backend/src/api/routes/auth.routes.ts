import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authService } from '../../auth/index.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { ApiResponse } from '../../common/types.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Register new user
  app.post('/register', async (request, reply) => {
    try {
      const input = registerSchema.parse(request.body);
      const result = await authService.register(input);

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };

      reply.status(201).send(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: error.errors,
          },
        });
        return;
      }

      reply.status(400).send({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: (error as Error).message,
        },
      });
    }
  });

  // Login
  app.post('/login', async (request, reply) => {
    try {
      const input = loginSchema.parse(request.body);
      const result = await authService.login(input);

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };

      reply.send(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: error.errors,
          },
        });
        return;
      }

      reply.status(401).send({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: (error as Error).message,
        },
      });
    }
  });

  // Logout (just for API completeness - JWT is stateless)
  app.post('/logout', { preHandler: [authenticate] }, async (_request, reply) => {
    // In a real implementation, you might want to blacklist the token
    reply.send({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  });

  // Get current user
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    reply.send({
      success: true,
      data: request.user,
    });
  });
}
