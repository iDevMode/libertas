// Config validation runs at import time and exits the process if required values are missing.
// Unit tests never touch these services, so placeholder values are enough.
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/libertas_test';
process.env.JWT_SECRET ??= 'test-only-secret-that-is-at-least-32-chars';
process.env.LOG_LEVEL ??= 'silent';
