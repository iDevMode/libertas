import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  // Server
  port: z.coerce.number().default(8000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  corsOrigins: z.string().transform((s) => s.split(',')).default('http://localhost:3000'),

  // Database
  databaseUrl: z.string(),

  // Redis
  redisUrl: z.string().default('redis://localhost:6379'),

  // JWT
  jwtSecret: z.string().min(32),
  jwtExpiresIn: z.string().default('24h'),

  // OAuth - Notion
  notionClientId: z.string().optional(),
  notionClientSecret: z.string().optional(),
  notionRedirectUri: z.string().optional(),

  // OAuth - Airtable
  airtableClientId: z.string().optional(),
  airtableClientSecret: z.string().optional(),
  airtableRedirectUri: z.string().optional(),

  // OAuth - Google
  googleClientId: z.string().optional(),
  googleClientSecret: z.string().optional(),
  googleRedirectUri: z.string().optional(),

  // File Storage
  exportDir: z.string().default('/tmp/libertas/exports'),

  // Encryption
  encryptionKey: z.string().min(32).optional(),
});

const parseConfig = (): z.infer<typeof configSchema> => {
  const result = configSchema.safeParse({
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    corsOrigins: process.env.CORS_ORIGINS,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    notionClientId: process.env.NOTION_CLIENT_ID,
    notionClientSecret: process.env.NOTION_CLIENT_SECRET,
    notionRedirectUri: process.env.NOTION_REDIRECT_URI,
    airtableClientId: process.env.AIRTABLE_CLIENT_ID,
    airtableClientSecret: process.env.AIRTABLE_CLIENT_SECRET,
    airtableRedirectUri: process.env.AIRTABLE_REDIRECT_URI,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
    exportDir: process.env.EXPORT_DIR,
    encryptionKey: process.env.ENCRYPTION_KEY,
  });

  if (!result.success) {
    console.error('Invalid configuration:', result.error.format());
    process.exit(1);
  }

  return result.data;
};

export const config = parseConfig();
