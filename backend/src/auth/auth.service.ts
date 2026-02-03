import bcrypt from 'bcrypt';
import { prisma } from '../common/database.js';
import { config } from '../common/config.js';
import { logger } from '../common/logger.js';
import { UserPayload, SubscriptionTier } from '../common/types.js';

const BCRYPT_ROUNDS = 12;

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: UserPayload;
  token: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        subscriptionTier: 'community',
      },
    });

    logger.info({ userId: user.id, email: user.email }, 'User registered');

    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      tier: user.subscriptionTier as SubscriptionTier,
    };

    const token = await this.generateToken(payload);

    return { user: payload, token };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user || !user.passwordHash) {
      throw new Error('Invalid email or password');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);

    if (!valid) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    logger.info({ userId: user.id, email: user.email }, 'User logged in');

    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      tier: user.subscriptionTier as SubscriptionTier,
    };

    const token = await this.generateToken(payload);

    return { user: payload, token };
  }

  async validateToken(token: string): Promise<UserPayload | null> {
    try {
      // In production, use proper JWT validation
      // This is a simplified version
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      // Check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return null;
      }

      return {
        id: payload.sub,
        email: payload.email,
        tier: payload.tier,
      };
    } catch {
      return null;
    }
  }

  async getUserById(id: string): Promise<UserPayload | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      tier: user.subscriptionTier as SubscriptionTier,
    };
  }

  private async generateToken(payload: UserPayload): Promise<string> {
    // Simplified JWT generation
    // In production, use @fastify/jwt properly
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 24 * 60 * 60; // 24 hours

    const body = Buffer.from(
      JSON.stringify({
        sub: payload.id,
        email: payload.email,
        tier: payload.tier,
        iat: now,
        exp,
      })
    ).toString('base64');

    // In production, sign with config.jwtSecret
    const signature = Buffer.from(`${header}.${body}.${config.jwtSecret}`).toString('base64');

    return `${header}.${body}.${signature}`;
  }
}

export const authService = new AuthService();
