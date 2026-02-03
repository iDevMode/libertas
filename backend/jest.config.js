/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@connectors/(.*)$': '<rootDir>/src/connectors/$1',
    '^@transformers/(.*)$': '<rootDir>/src/transformers/$1',
    '^@destinations/(.*)$': '<rootDir>/src/destinations/$1',
    '^@jobs/(.*)$': '<rootDir>/src/jobs/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
  },
};
