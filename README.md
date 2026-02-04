# Libertas - Data Liberation Platform

End vendor lock-in by extracting, owning, and controlling your data from SaaS platforms.

## Overview

Libertas is an open-source tool that enables users to extract complete datasets from SaaS platforms (Notion, Airtable, Google Sheets), normalize them into a universal schema, and export to user-owned databases or portable file formats.

**Core Philosophy**: Data Freedom First - extract 100% of your data with no new lock-in.

## Features

- **Platform Connectors**: Extract data from Notion (more platforms coming soon)
- **Multiple Export Formats**: SQLite, JSON, CSV, Markdown
- **Full Content Extraction**: Pages, databases, properties, content blocks, attachments
- **Real-time Progress**: WebSocket-based live updates during exports
- **Data Browser**: Browse and search exported data through the web UI
- **Entity Detail View**: View full page content including properties, rich text, and relations

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- Shadcn/ui + Radix UI
- TailwindCSS
- Zustand (state management)
- Socket.io-client (real-time updates)

### Backend
- Node.js 20 (TypeScript)
- Fastify
- Prisma ORM
- BullMQ (job queue)
- Socket.io (WebSocket)

### Infrastructure
- PostgreSQL 16 (platform database)
- Redis 7 (job queue)
- SQLite (export destination)
- Docker + Docker Compose

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Notion OAuth app credentials (for Notion exports)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/iDevMode/libertas.git
   cd libertas
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:
   ```env
   # Database
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/libertas

   # Redis
   REDIS_URL=redis://localhost:6379

   # Auth
   JWT_SECRET=your-secret-key

   # Notion OAuth
   NOTION_CLIENT_ID=your-notion-client-id
   NOTION_CLIENT_SECRET=your-notion-client-secret
   NOTION_REDIRECT_URI=http://localhost:3000/api/auth/notion/callback
   ```

3. **Start infrastructure**
   ```bash
   docker-compose up -d postgres redis
   ```

4. **Install dependencies and run migrations**
   ```bash
   # Backend
   cd backend
   npm install
   npx prisma migrate dev

   # Frontend
   cd ../frontend
   npm install
   ```

5. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

6. **Open the app**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

## Usage

### 1. Create an Account
Register or log in at http://localhost:3000

### 2. Connect a Platform
- Go to Dashboard
- Click "Connect" on Notion
- Authorize access to your Notion workspace

### 3. Start an Export
- Select databases/pages to export
- Choose export format (SQLite, JSON, CSV, Markdown)
- Click "Start Export"

### 4. Browse Your Data
- View export progress in real-time
- Once complete, click "Browse Data" to explore
- Click on any entity to see full details (properties, content, attachments)
- Download the export file

## Project Structure

```
libertas/
├── backend/
│   ├── src/
│   │   ├── api/              # REST API routes
│   │   ├── auth/             # Authentication
│   │   ├── connectors/       # Platform connectors (Notion, etc.)
│   │   ├── destinations/     # Export adapters (SQLite, JSON, CSV, MD)
│   │   ├── jobs/             # Background job workers
│   │   ├── transformers/     # Data normalizers
│   │   └── websocket/        # Real-time updates
│   └── prisma/               # Database schema
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js pages
│   │   ├── components/       # React components
│   │   ├── lib/              # Utilities & API client
│   │   └── stores/           # Zustand state stores
└── docker-compose.yml
```

## Universal Schema

All extracted data is normalized to these tables:

| Table | Description |
|-------|-------------|
| `entities` | Core records (pages, database items) |
| `properties` | Entity properties (EAV pattern) |
| `relations` | Links between entities |
| `content_blocks` | Rich text content (paragraphs, headings, lists) |
| `attachments` | File attachments |

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user

### Connections
- `GET /api/connections` - List connected platforms
- `GET /api/connections/:platform/authorize` - Get OAuth URL
- `POST /api/connections/:platform/connect` - Complete OAuth
- `DELETE /api/connections/:id` - Disconnect

### Jobs
- `POST /api/jobs` - Create export job
- `GET /api/jobs` - List jobs
- `GET /api/jobs/:id` - Job status
- `DELETE /api/jobs/:id` - Cancel job

### Exports
- `GET /api/exports/:jobId/entities` - List entities
- `GET /api/exports/:jobId/entities/:id` - Entity details
- `GET /api/exports/:jobId/file` - Download export

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for JWT tokens |
| `NOTION_CLIENT_ID` | Notion OAuth client ID |
| `NOTION_CLIENT_SECRET` | Notion OAuth client secret |
| `NOTION_REDIRECT_URI` | Notion OAuth redirect URI |
| `EXPORT_DIR` | Directory for export files (default: `/tmp/libertas/exports`) |

## Roadmap

### Phase 1 (MVP) - Current
- [x] Notion connector
- [x] SQLite, JSON, CSV, Markdown exports
- [x] Basic web UI
- [x] Entity detail view
- [x] Real-time progress updates

### Phase 2
- [ ] Airtable connector
- [ ] Google Sheets connector
- [ ] PostgreSQL export destination
- [ ] Scheduled exports

### Phase 3
- [ ] Incremental sync
- [ ] CLI tool
- [ ] More connectors

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

## License

MIT License - see LICENSE file for details.
