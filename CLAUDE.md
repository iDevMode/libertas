# Data Liberation Platform

## Project Overview

Data Liberation Platform is an open-source tool that ends vendor lock-in by enabling users to extract, own, and control their data from SaaS platforms (Notion, Airtable, Google Sheets). The platform extracts complete datasets, normalizes them into a universal schema, and exports to user-owned databases (SQLite, PostgreSQL) or portable file formats (JSON, CSV, Markdown).

**Core Philosophy**: Data Freedom First - users must be able to extract 100% of their data with no new lock-in.

## Current Phase: MVP (Phase 1)

### MVP Scope
- **3 Core Connectors**: Notion, Airtable, Google Sheets
- **Destinations**: SQLite (default), JSON, CSV, Markdown
- **UI**: Basic table view for browsing exported data
- **Deployment**: Docker + manual installation
- **Auth**: Email/password authentication

### Out of Scope for MVP
- Scheduled exports (Phase 2)
- PostgreSQL destination (Phase 2)
- Premium connectors (Phase 2)
- Team features (Phase 4)
- Real-time sync

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Components**: Shadcn/ui + Radix UI
- **Styling**: TailwindCSS
- **State**: Zustand
- **Data Fetching**: TanStack Query
- **WebSocket**: Socket.io-client
- **Tables**: TanStack Table

### Backend
- **Runtime**: Node.js 20 (TypeScript)
- **Framework**: NestJS or Fastify
- **API**: REST (GraphQL optional for later)
- **Real-time**: Socket.io
- **Validation**: Zod

### Infrastructure
- **Platform Database**: PostgreSQL 16
- **Job Queue**: Redis 7 + BullMQ
- **File Storage**: Local filesystem (S3 for hosted version later)
- **Containerization**: Docker + Docker Compose

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web App    │  │  Desktop App │  │   CLI Tool   │      │
│  │ (Next.js)    │  │  (Future)    │  │   (Future)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                              │
│  REST API │ WebSocket (real-time progress updates)          │
│  Auth │ Rate Limiting │ Job Management                      │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌──────────────┐  ┌─────────────┐
│  CONNECTOR  │  │  TRANSFORM   │  │ DESTINATION │
│   ENGINE    │  │    ENGINE    │  │   WRITER    │
└─────────────┘  └──────────────┘  └─────────────┘
```

### Core Components

1. **Connector Engine** - Plugin-based system for extracting data from platforms
   - Each connector implements `IConnector` interface
   - Handles OAuth, rate limiting, pagination
   - MVP connectors: Notion, Airtable, Google Sheets

2. **Transform Engine** - Normalizes platform-specific data to universal schema
   - Parses raw API responses
   - Extracts entities, properties, relations
   - Validates data integrity

3. **Destination Writer** - Writes normalized data to user's chosen format
   - SQLite adapter (default)
   - JSON/CSV file exporters
   - Markdown exporter (for Notion pages)

4. **Job Queue** - Manages long-running export jobs
   - BullMQ workers process jobs asynchronously
   - Real-time progress via WebSocket
   - Pause/resume/cancel support

## Project Structure

```
libertas/
├── backend/
│   ├── src/
│   │   ├── connectors/           # Platform connectors
│   │   │   ├── notion/
│   │   │   ├── airtable/
│   │   │   └── google-sheets/
│   │   ├── transformers/         # Data normalizers
│   │   ├── destinations/         # Output adapters (SQLite, JSON, CSV)
│   │   ├── jobs/                 # Job queue workers
│   │   ├── api/                  # REST endpoints
│   │   ├── auth/                 # Authentication
│   │   └── common/               # Shared utilities
│   ├── prisma/                   # Database schema & migrations
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js App Router pages
│   │   ├── components/           # UI components
│   │   ├── hooks/                # Custom React hooks
│   │   ├── lib/                  # Utilities
│   │   └── stores/               # Zustand stores
│   └── tests/
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env.example
```

## Universal Schema

All extracted data normalizes to these tables in the user's SQLite/PostgreSQL:

```sql
-- Core entity (page, record, task, etc.)
entities (id, entity_type, title, created_at, updated_at, parent_id, source_platform, source_url, metadata)

-- Entity properties (EAV pattern)
properties (id, entity_id, property_name, property_type, value_text, value_number, value_date, value_boolean, value_json)

-- Links between entities
relations (id, from_entity_id, to_entity_id, relation_type, metadata)

-- Rich text content blocks
content_blocks (id, entity_id, block_type, content, position, parent_block_id, metadata)

-- File attachments
attachments (id, entity_id, file_name, file_type, file_size, source_url, local_path)
```

## Key Interfaces

### IConnector
```typescript
interface IConnector {
  name: string;
  platform: string;
  tier: 'community' | 'pro' | 'enterprise';

  authenticate(credentials: OAuthCredentials): Promise<AuthToken>;
  refreshToken(token: AuthToken): Promise<AuthToken>;
  discoverSchema(): Promise<SourceSchema>;
  listEntities(filter?: Filter): Promise<EntityList>;
  extractEntity(id: string): Promise<RawEntity>;
  extractBatch(ids: string[]): AsyncGenerator<RawEntity>;
  getRateLimits(): RateLimitConfig;
  getCapabilities(): ConnectorCapabilities;
}
```

### INormalizer
```typescript
interface INormalizer {
  normalizeEntity(raw: RawEntity): NormalizedEntity;
  normalizeProperty(raw: RawProperty): NormalizedProperty[];
  normalizeRelation(raw: RawRelation): NormalizedRelation;
  normalizeContentBlock(raw: RawBlock): NormalizedBlock;
}
```

### IDestinationAdapter
```typescript
interface IDestinationAdapter {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  createSchema(schema: UniversalSchema): Promise<void>;
  beginTransaction(): Promise<Transaction>;
  writeBatch(table: string, records: Record[]): Promise<WriteResult>;
  commit(transaction: Transaction): Promise<void>;
  rollback(transaction: Transaction): Promise<void>;
}
```

## Development Workflow

### Setup
```bash
# Clone and install
git clone https://github.com/data-liberation/platform.git
cd platform
cd backend && npm install
cd ../frontend && npm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Start infrastructure
docker-compose up -d postgres redis

# Run migrations
npm run migrate

# Start development servers
npm run dev
```

### Branch Naming
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation

### Commit Convention
Use Conventional Commits:
```
feat: add Notion connector OAuth flow
fix: handle rate limit errors in Airtable connector
refactor: extract common pagination logic
docs: add connector development guide
```

### Testing
```bash
npm test                  # All tests
npm run test:coverage     # With coverage report
npm run test:integration  # Integration tests only
```

**Coverage requirement**: Minimum 80%

## Coding Standards

### TypeScript
- ESLint + Prettier for formatting
- 2-space indentation
- camelCase for variables/functions
- PascalCase for classes/interfaces
- UPPER_SNAKE_CASE for constants
- Avoid `any` - use proper types
- Functions should be <50 lines
- Explicit error handling required

### File Organization
- One class/component per file
- Group related files in feature folders
- Keep imports organized (external, internal, relative)

## API Endpoints (MVP)

```
# Authentication
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

# Platform Connections
GET    /api/connections
POST   /api/connections/:platform/connect
DELETE /api/connections/:id
GET    /api/connections/:id/schema

# Export Jobs
POST   /api/jobs
GET    /api/jobs
GET    /api/jobs/:id
DELETE /api/jobs/:id
GET    /api/jobs/:id/download

# Data Browser
GET    /api/exports/:jobId/entities
GET    /api/exports/:jobId/entities/:id
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/libertas

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# OAuth - Notion
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
NOTION_REDIRECT_URI=http://localhost:3000/api/auth/notion/callback

# OAuth - Airtable
AIRTABLE_CLIENT_ID=
AIRTABLE_CLIENT_SECRET=
AIRTABLE_REDIRECT_URI=http://localhost:3000/api/auth/airtable/callback

# OAuth - Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# File Storage
EXPORT_DIR=/tmp/libertas/exports
```

## Platform Database Schema (PostgreSQL)

Key tables in the platform's own database (not user exports):

- `users` - User accounts and subscriptions
- `connected_accounts` - OAuth tokens for third-party platforms
- `migration_jobs` - Export job tracking and status
- `source_schemas` - Cached schema from source platforms
- `connectors` - Available connector metadata
- `audit_logs` - Compliance and debugging logs

## Rate Limits by Platform

| Platform | Requests/Second | Notes |
|----------|-----------------|-------|
| Notion | 3 | Strict, requires backoff |
| Airtable | 5 | Per-base limits |
| Google Sheets | 60 | Per-minute quota |

## Security Considerations

- OAuth tokens encrypted at rest (AES-256)
- Passwords hashed with bcrypt (cost: 12)
- JWT tokens with 24-hour expiration
- All API inputs validated with Zod
- Parameterized queries (no SQL injection)
- Rate limiting: 100 requests/minute per user
- HTTPS only in production

## Common Tasks

### Adding a New Connector
1. Create folder in `backend/src/connectors/{platform}/`
2. Implement `IConnector` interface
3. Implement corresponding normalizer
4. Add OAuth configuration
5. Write unit and integration tests
6. Register in connector factory
7. Update documentation

### Adding a New Destination
1. Create adapter in `backend/src/destinations/`
2. Implement `IDestinationAdapter` interface
3. Add configuration options
4. Write tests
5. Update export job to support new destination

### Running Database Migrations
```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Apply migrations
npm run migrate

# Check migration status
npm run migrate:status
```

## Success Metrics (MVP)

- Export success rate >95%
- Time to first export <15 minutes
- API response time <200ms (p95)
- Job completion <10 minutes for 10k records

## Resources

- [PRD](./Libertas-PRD.md) - Full product requirements
- [SOP](./Libertas-SOP.md) - Operating procedures
- [Notion API Docs](https://developers.notion.com/)
- [Airtable API Docs](https://airtable.com/developers/web/api/introduction)
- [Google Sheets API](https://developers.google.com/sheets/api)
