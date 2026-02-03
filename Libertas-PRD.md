# Product Requirements Document (PRD)
# Data Liberation Platform

**Version:** 1.0  
**Date:** February 3, 2026  
**Document Owner:** Product Team  
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Vision & Mission](#vision--mission)
4. [Product Overview](#product-overview)
5. [Target Users](#target-users)
6. [Core Features](#core-features)
7. [Technical Architecture](#technical-architecture)
8. [User Journey & Workflows](#user-journey--workflows)
9. [Data Models & Schema](#data-models--schema)
10. [Monetization Strategy](#monetization-strategy)
11. [Success Metrics](#success-metrics)
12. [Technical Requirements](#technical-requirements)
13. [Security & Compliance](#security--compliance)
14. [Roadmap](#roadmap)
15. [Open Questions & Risks](#open-questions--risks)

---

## Executive Summary

**Data Liberation Platform** is an open-source tool designed to end vendor lock-in by enabling users to extract, own, and control their data from popular SaaS platforms (Notion, Airtable, Google Workspace, etc.). 

The platform acts as a universal **data extraction engine** that:
- Connects to third-party platforms via OAuth/API
- Extracts complete data sets (pages, databases, records, documents)
- Normalizes disparate data structures into a unified, queryable format
- Exports to user-owned databases (SQLite, PostgreSQL) or portable file formats (JSON, CSV, Markdown)
- Provides intuitive table-based views for non-technical users
- Ensures true data sovereignty with no ongoing platform dependency

**Business Model:**
- **Community Edition**: Free, open-source with 3-5 core connectors
- **Paid Edition**: Premium connectors (50+), advanced features, priority support

---

## Problem Statement

### Current Pain Points

1. **Vendor Lock-In**
   - Users invest years building knowledge bases, project databases, and workflows in platforms like Notion or Airtable
   - When they want to leave (pricing changes, feature removals, platform instability), they lose access to their data
   - Export features are often limited, lossy, or produce unusable formats

2. **Data Sovereignty Issues**
   - Users don't truly "own" their data—they rent access to it
   - No ability to query data with custom tools or integrate with other systems
   - Dependent on platform availability and pricing

3. **Limited Portability**
   - Existing tools focus on platform-to-platform migration, not liberation
   - No standardized format for personal data ownership
   - Technical barriers prevent non-developers from accessing their own data

4. **Expensive Migration**
   - Enterprise ETL tools (Airbyte, Fivetran) are overkill and expensive for individual users
   - Custom scripts require technical expertise
   - No simple "one-click" solution for data extraction

### Market Gap

**Existing solutions are either:**
- Too expensive (enterprise ETL platforms)
- Too technical (custom API scripts)
- Too limited (platform-specific export tools)
- Incomplete (CSV exports lose structure, relations, and formatting)

**No solution prioritizes user data sovereignty as the core mission.**

---

## Vision & Mission

### Vision
**A world where individuals and organizations have complete ownership and control over their digital work, free from platform lock-in.**

### Mission
**Empower every user to liberate their data from proprietary platforms through accessible, open-source technology that prioritizes data sovereignty, portability, and user control.**

### Core Principles

1. **Data Freedom First**: Users must be able to extract 100% of their data, including metadata, relations, and rich content
2. **Open by Default**: Community edition must be genuinely useful, not crippled
3. **No New Lock-In**: Our platform must not become another walled garden
4. **Technical Accessibility**: Non-technical users should be able to liberate their data
5. **Transparency**: Open-source core, clear documentation, auditable code

---

## Product Overview

### What It Does

**Data Liberation Platform** is a self-hosted application that:

1. **Connects** to SaaS platforms via OAuth/API authentication
2. **Discovers** the user's data structure (databases, pages, folders, records)
3. **Extracts** complete data sets with all metadata, relations, and attachments
4. **Normalizes** diverse data structures into a universal schema
5. **Transforms** data according to user-defined mappings (optional)
6. **Loads** data into user-owned destinations (SQLite, PostgreSQL, files)
7. **Presents** liberated data in familiar table views, JSON exports, or hierarchical trees
8. **Validates** extraction completeness with checksums and integrity reports

### What It Doesn't Do

- ❌ Not a general-purpose ETL platform for enterprise data pipelines
- ❌ Not a real-time sync tool (focuses on one-time liberation, with optional scheduled re-exports)
- ❌ Not a data warehouse or analytics platform (just extracts and normalizes)
- ❌ Not a platform migration tool (doesn't push data back into other platforms)

### Key Differentiators

| Feature | Data Liberation Platform | Enterprise ETL (Airbyte) | Platform Exports | Custom Scripts |
|---------|-------------------------|--------------------------|------------------|----------------|
| **Cost** | Free (community) / $29/mo (pro) | $500+/mo | Free | Free (if you can code) |
| **Target User** | Individuals, small teams | Enterprises | Anyone | Developers only |
| **Data Ownership** | ✅ Full (SQLite file you own) | ⚠️ Depends on setup | ❌ Limited (CSV only) | ✅ Full |
| **Ease of Use** | ✅ GUI + CLI | ⚠️ Technical setup | ✅ One-click | ❌ Code required |
| **Completeness** | ✅ 100% with relations | ✅ 100% | ❌ Often incomplete | ⚠️ Depends on skill |
| **Open Source** | ✅ Core is open | ⚠️ Partially | ❌ Proprietary | ✅ Your code |
| **Philosophy** | **Data sovereignty** | Business integration | Minimal compliance | DIY |

---

## Target Users

### Primary Personas

#### 1. **The Privacy Advocate** (Early Adopter)
- **Profile**: 
  - Age 25-40, tech-savvy but not necessarily a developer
  - Values data ownership, privacy, and digital rights
  - Active in communities like r/selfhosted, Hacker News, Mastodon
- **Pain Points**:
  - Uncomfortable with corporations owning their intellectual output
  - Wants to self-host everything but platforms don't allow it
  - Frustrated by lack of control over personal data
- **Use Case**: 
  - Export entire Notion workspace to self-hosted PostgreSQL
  - Keep local backups of all work in case Notion shuts down or changes pricing
  - Query personal knowledge base with custom tools
- **Success Criteria**: 
  - Can run tool locally without sending data to third parties
  - Gets complete, queryable database they fully control
  - Can delete Notion account knowing nothing is lost

#### 2. **The Freelancer / Creator** (High Value User)
- **Profile**:
  - Age 28-45, runs small business or freelance practice
  - Uses tools like Notion, Airtable for client work and project management
  - Pays $20-50/mo for SaaS tools but worries about long-term costs
- **Pain Points**:
  - Fears losing client work if platform shuts down
  - Hit limitations of free tier but hesitant to upgrade
  - Wants to own portfolio of work built over years
- **Use Case**:
  - Export client project database before subscription expires
  - Archive completed work in portable format (SQLite/JSON)
  - Migrate between platforms without losing historical data
- **Success Criteria**:
  - Simple UI, doesn't require technical knowledge
  - Complete export including attachments and comments
  - Can browse exported data without platform access

#### 3. **The Power User** (Pro Tier Candidate)
- **Profile**:
  - Age 30-50, product manager, analyst, or technical project lead
  - Manages complex workflows across multiple platforms
  - Comfortable with databases and SQL
- **Pain Points**:
  - Data scattered across Notion, Airtable, Asana, Google Sheets
  - Needs to consolidate for reporting and analysis
  - Wants to query data in ways platforms don't support
- **Use Case**:
  - Export from 5+ platforms into unified PostgreSQL database
  - Run custom SQL queries and BI dashboards (Metabase)
  - Scheduled weekly backups with incremental sync
- **Success Criteria**:
  - Can map complex schemas with custom transformations
  - PostgreSQL output integrates with existing data stack
  - Automated, scheduled exports

#### 4. **The Small Business Owner** (Enterprise Candidate)
- **Profile**:
  - Age 35-60, runs 5-50 person company
  - Entire team uses Notion/Airtable for operations
  - Concerned about business continuity and vendor risk
- **Pain Points**:
  - Entire business knowledge locked in third-party platform
  - No disaster recovery plan if platform goes down
  - Vendor pricing unpredictable (per-seat costs)
- **Use Case**:
  - Regular automated backups of all company data
  - Compliance requirement to maintain data outside vendor
  - Peace of mind with disaster recovery plan
- **Success Criteria**:
  - Team-wide export permissions and management
  - Audit logs for compliance
  - Dedicated support and SLA

### Secondary Personas

- **Students**: Backing up academic work before graduation
- **Researchers**: Archiving project documentation and notes
- **Activists/Journalists**: Protecting sensitive information from platform censorship
- **Developers**: Building custom tools on top of liberated data

---

## Core Features

### Community Edition (Free, Open Source)

#### 1. **Platform Connectors** (3-5 Core Platforms)

**Included Connectors:**
1. **Notion** - Pages, databases, blocks, comments
2. **Airtable** - Bases, tables, views, attachments
3. **Google Sheets** - Spreadsheets, worksheets, formulas

**Connector Capabilities:**
- OAuth 2.0 authentication
- Full schema discovery
- Complete data extraction (no sampling)
- Relation preservation
- Attachment download (optional)
- Rate limit compliance
- Error handling and retry logic

#### 2. **Destination Formats**

**SQLite (Default)**
- Single-file database (`my-data.db`)
- Universal schema (entities, properties, relations)
- Queryable with any SQLite client
- Portable, no server required

**File Exports**
- **JSON**: Structured, one file per entity type
- **CSV**: Flat tables, one file per table
- **Markdown**: For Notion pages (preserves formatting)

#### 3. **Data Extraction Pipeline**

**Stage 1: Discovery**
- Scan user's connected accounts
- List available databases, pages, folders
- Show preview: "150 pages, 2.5 GB"

**Stage 2: Selection**
- User selects what to export
- Checkboxes for databases/folders
- Option to include/exclude attachments

**Stage 3: Extraction**
- Background job with progress bar
- Real-time status updates
- Pause/resume capability
- Error logging and recovery

**Stage 4: Normalization**
- Transform to universal schema
- Preserve all metadata and relations
- Generate integrity report

**Stage 5: Export**
- Write to SQLite or files
- Validation and checksums
- Downloadable result

#### 4. **Data Presentation**

**Table View (Primary UI)**
- Spreadsheet-like interface
- Auto-generated columns from properties
- Sortable, filterable, searchable
- Export to CSV/Excel

**JSON View**
- Raw structured data
- Copy-paste friendly
- Syntax highlighted

**Entity Browser**
- Navigate through entities
- View individual records
- Follow relations (links)

#### 5. **Self-Hosting**

**Docker Deployment**
```bash
docker-compose up -d
# Access at http://localhost:3000
```

**Manual Installation**
```bash
git clone https://github.com/data-liberation/platform
cd platform
npm install
npm run build
npm start
```

**Requirements**
- Node.js 20+ or Python 3.11+
- PostgreSQL 16+ (for platform database)
- 2GB RAM minimum
- Docker (recommended)

---

### Paid Edition Features

#### Pro Tier ($29/month)

**Additional Connectors (20+ platforms)**
- Asana, Monday.com, ClickUp
- Trello, Jira, Linear
- Evernote, Bear, Obsidian
- Dropbox Paper, Confluence
- Coda, Fibery
- Basecamp, Teamwork
- Google Docs, Microsoft OneNote
- Todoist, Any.do
- Roam Research, Logseq

**Advanced Destinations**
- PostgreSQL (self-hosted or cloud)
- MySQL/MariaDB
- DuckDB (analytics)

**Enhanced Features**
- **Scheduled Exports**: Daily/weekly automatic backups
- **Incremental Sync**: Only export changes since last run
- **Custom Schema Mapping**: Visual mapper for complex transformations
- **Multiple Destinations**: Export to SQLite AND PostgreSQL simultaneously
- **Webhook Notifications**: Get alerts when exports complete
- **Priority Support**: Email support with 24-48hr response time

**Usage Limits**
- Unlimited exports per month
- Up to 1M records per export
- Up to 100GB data per month

#### Enterprise Tier ($299/month)

**All Pro Features +**

**Unlimited Connectors**
- Access to entire connector marketplace
- Custom connector development (on request)
- Priority for new connector requests

**Team Features**
- Multi-user access with role-based permissions
- Shared export configurations
- Centralized audit logs
- Team dashboard

**Advanced Capabilities**
- **Real-time Sync**: Continuous updates via webhooks (where supported)
- **Data Transformation Scripts**: Python/JS custom transformations
- **API Access**: REST API to trigger exports programmatically
- **Managed Hosting**: Optional cloud hosting (we run it for you)

**Enterprise Support**
- Dedicated support engineer
- 4-hour response SLA
- Video calls for onboarding
- Custom deployment assistance
- Annual business reviews

**Compliance**
- SOC 2 Type II compliance
- GDPR data processing agreement
- Audit logs with 1-year retention
- Data encryption at rest and in transit

---

## Technical Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Web App    │  │  Desktop App │  │   CLI Tool   │     │
│  │ (Next.js)    │  │  (Electron)  │  │   (Python)   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                              │
│                  (FastAPI / Node.js)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  REST API │ GraphQL │ WebSocket (real-time updates) │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Auth │ Rate Limiting │ Job Management │ Monitoring │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌──────────────┐  ┌─────────────┐
│  CONNECTOR  │  │  TRANSFORM   │  │ DESTINATION │
│   ENGINE    │  │    ENGINE    │  │   WRITER    │
└─────────────┘  └──────────────┘  └─────────────┘
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌──────────────┐  ┌─────────────┐
│  Source     │  │  Universal   │  │  User's     │
│  Platform   │  │  Schema      │  │  Database   │
│  APIs       │  │  (Normalized)│  │  (SQLite/   │
│             │  │              │  │  Postgres)  │
└─────────────┘  └──────────────┘  └─────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Platform DB │  │  Job Queue   │  │  File Store  │     │
│  │ (PostgreSQL) │  │  (Redis/     │  │  (S3/Local)  │     │
│  │              │  │  BullMQ)     │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **Platform Database (PostgreSQL)**

**Purpose**: Stores application state, NOT user data

**Key Tables**:
- `users` - User accounts and authentication
- `connected_accounts` - OAuth tokens for third-party platforms
- `migration_jobs` - Export job tracking and status
- `source_schemas` - Cached schema from source platforms
- `connectors` - Available platform connectors and capabilities
- `audit_logs` - Compliance and debugging logs

**Schema Details**: See [Data Models & Schema](#data-models--schema)

#### 2. **Connector Engine (Plugin System)**

**Architecture**: Plugin-based with standard interface

```typescript
interface IConnector {
  // Metadata
  name: string;
  version: string;
  platform: string;
  tier: 'community' | 'pro' | 'enterprise';
  
  // Authentication
  authenticate(credentials: OAuthCredentials): Promise<AuthToken>;
  refreshToken(token: AuthToken): Promise<AuthToken>;
  
  // Discovery
  discoverSchema(): Promise<SourceSchema>;
  listEntities(filter?: Filter): Promise<EntityList>;
  
  // Extraction
  extractEntity(id: string): Promise<RawEntity>;
  extractBatch(ids: string[]): AsyncGenerator<RawEntity>;
  
  // Metadata
  getRateLimits(): RateLimitConfig;
  getCapabilities(): ConnectorCapabilities;
}
```

**Connector Responsibilities**:
1. Handle platform-specific authentication (OAuth, API keys)
2. Discover user's data structure on the platform
3. Extract raw data via platform APIs
4. Respect rate limits and implement backoff
5. Handle pagination and large datasets
6. Download attachments (if requested)
7. Report progress and errors

**Example: Notion Connector**

```typescript
class NotionConnector implements IConnector {
  name = 'notion';
  platform = 'Notion';
  tier = 'community';
  
  async authenticate(credentials: OAuthCredentials) {
    // OAuth 2.0 flow
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: credentials.code,
        redirect_uri: credentials.redirect_uri
      })
    });
    return response.json();
  }
  
  async discoverSchema() {
    // Fetch all databases and pages
    const databases = await this.listDatabases();
    const pages = await this.listPages();
    
    return {
      databases: databases.map(db => ({
        id: db.id,
        title: db.title,
        properties: db.properties,
        estimated_records: db.estimated_records
      })),
      pages: pages.length,
      total_size_estimate: this.estimateSize(databases, pages)
    };
  }
  
  async *extractBatch(entityIds: string[]) {
    for (const id of entityIds) {
      // Respect rate limits (3 requests/second for Notion)
      await this.rateLimiter.waitForToken();
      
      try {
        const page = await this.fetchPage(id);
        yield {
          id: page.id,
          type: 'page',
          raw_data: page,
          extracted_at: new Date()
        };
      } catch (error) {
        this.handleError(error, id);
      }
    }
  }
  
  getRateLimits() {
    return {
      requests_per_second: 3,
      burst_size: 10
    };
  }
}
```

#### 3. **Transform Engine (Normalization)**

**Purpose**: Convert platform-specific data to universal schema

**Transformation Pipeline**:

```
Raw JSON (from API)
    ↓
Parse & Validate
    ↓
Extract Entities
    ↓
Extract Properties
    ↓
Extract Relations
    ↓
Extract Content Blocks
    ↓
Normalized Data (universal schema)
```

**Normalizer Interface**:

```typescript
interface INormalizer {
  normalizeEntity(raw: RawEntity): NormalizedEntity;
  normalizeProperty(raw: RawProperty): NormalizedProperty[];
  normalizeRelation(raw: RawRelation): NormalizedRelation;
  normalizeContentBlock(raw: RawBlock): NormalizedBlock;
}
```

**Example: Notion to Universal Schema**

```typescript
class NotionNormalizer implements INormalizer {
  
  normalizeEntity(rawPage: NotionPage): NormalizedEntity {
    return {
      id: rawPage.id,
      entity_type: 'page',
      title: this.extractTitle(rawPage.properties),
      created_at: new Date(rawPage.created_time),
      updated_at: new Date(rawPage.last_edited_time),
      parent_id: this.extractParentId(rawPage.parent),
      source_platform: 'notion',
      source_url: `https://notion.so/${rawPage.id.replace(/-/g, '')}`,
      metadata: {
        icon: rawPage.icon,
        cover: rawPage.cover,
        archived: rawPage.archived
      }
    };
  }
  
  normalizeProperty(rawProp: NotionProperty): NormalizedProperty[] {
    const props: NormalizedProperty[] = [];
    
    switch (rawProp.type) {
      case 'title':
      case 'rich_text':
        props.push({
          id: generateId(),
          entity_id: rawProp.entity_id,
          property_name: rawProp.name,
          property_type: 'text',
          value_text: this.extractPlainText(rawProp.value),
          value_json: rawProp.value // preserve formatting
        });
        break;
        
      case 'select':
        props.push({
          id: generateId(),
          entity_id: rawProp.entity_id,
          property_name: rawProp.name,
          property_type: 'select',
          value_text: rawProp.value.select?.name,
          value_json: { color: rawProp.value.select?.color }
        });
        break;
        
      case 'multi_select':
        props.push({
          id: generateId(),
          entity_id: rawProp.entity_id,
          property_name: rawProp.name,
          property_type: 'multi_select',
          value_json: rawProp.value.multi_select
        });
        break;
        
      // ... other types
    }
    
    return props;
  }
}
```

#### 4. **Destination Writer (Database Adapters)**

**Purpose**: Write normalized data to user's chosen destination

**Adapter Interface**:

```typescript
interface IDestinationAdapter {
  // Connection management
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;
  
  // Schema operations
  createSchema(schema: UniversalSchema): Promise<void>;
  getExistingSchema(): Promise<UniversalSchema | null>;
  
  // Data operations (transactional)
  beginTransaction(): Promise<Transaction>;
  writeBatch(table: string, records: Record[]): Promise<WriteResult>;
  commit(transaction: Transaction): Promise<void>;
  rollback(transaction: Transaction): Promise<void>;
  
  // Utility
  estimateSize(recordCount: number): Promise<number>;
  getCapabilities(): AdapterCapabilities;
}
```

**SQLite Adapter (Default)**:

```typescript
class SQLiteAdapter implements IDestinationAdapter {
  private db: Database;
  
  async connect(config: { filepath: string }) {
    this.db = new Database(config.filepath);
    await this.createUniversalSchema();
  }
  
  async createUniversalSchema() {
    // Create entities table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        title TEXT,
        created_at TEXT,
        updated_at TEXT,
        parent_id TEXT,
        source_platform TEXT NOT NULL,
        source_url TEXT,
        metadata TEXT,
        FOREIGN KEY (parent_id) REFERENCES entities(id)
      )
    `);
    
    // Create properties table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        property_name TEXT NOT NULL,
        property_type TEXT,
        value_text TEXT,
        value_number REAL,
        value_date TEXT,
        value_boolean INTEGER,
        value_json TEXT,
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
      )
    `);
    
    // Create relations table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        from_entity_id TEXT NOT NULL,
        to_entity_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (from_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (to_entity_id) REFERENCES entities(id) ON DELETE CASCADE
      )
    `);
    
    // Create indexes
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
      CREATE INDEX IF NOT EXISTS idx_entities_parent ON entities(parent_id);
      CREATE INDEX IF NOT EXISTS idx_properties_entity ON properties(entity_id);
      CREATE INDEX IF NOT EXISTS idx_properties_name ON properties(property_name);
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity_id);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity_id);
    `);
  }
  
  async writeBatch(table: string, records: Record[]): Promise<WriteResult> {
    const stmt = this.db.prepare(
      `INSERT INTO ${table} VALUES (${records[0].values.map(() => '?').join(',')})`
    );
    
    const transaction = this.db.transaction((records) => {
      for (const record of records) {
        stmt.run(record.values);
      }
    });
    
    transaction(records);
    
    return {
      inserted: records.length,
      failed: 0
    };
  }
  
  getCapabilities(): AdapterCapabilities {
    return {
      supportsTransactions: true,
      supportsRelations: true,
      supportsBulkInsert: true,
      maxBatchSize: 1000,
      supportsJSONFields: true,
      supportsFullTextSearch: true
    };
  }
}
```

#### 5. **Job Queue System (Redis + BullMQ)**

**Purpose**: Manage long-running export jobs asynchronously

**Job Flow**:

```
User Clicks "Export" 
    ↓
Create Job Record (DB)
    ↓
Add to Queue (Redis)
    ↓
Worker Picks Up Job
    ↓
Execute Pipeline:
  - Extract (connector)
  - Normalize (transformer)
  - Load (destination writer)
    ↓
Update Job Status (DB)
    ↓
Send Notification (WebSocket/Email)
```

**Job Schema**:

```typescript
interface MigrationJob {
  id: string;
  user_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  
  // Configuration
  source_platform: string;
  source_account_id: string;
  destination_type: 'sqlite' | 'postgresql' | 'json' | 'csv';
  destination_config: object;
  
  // Selection
  selected_entities: string[]; // which databases/pages to export
  include_attachments: boolean;
  
  // Stats
  records_total: number;
  records_processed: number;
  bytes_downloaded: number;
  started_at: Date;
  completed_at: Date;
  
  // Results
  output_path: string; // where SQLite file is stored
  error_message: string | null;
  validation_report: object;
}
```

**Worker Implementation**:

```typescript
// Worker process
const worker = new Worker('migration-jobs', async (job) => {
  const { jobId, userId, config } = job.data;
  
  try {
    // Update status
    await updateJob(jobId, { status: 'running', started_at: new Date() });
    
    // Initialize components
    const connector = ConnectorFactory.create(config.source_platform);
    const normalizer = new UniversalNormalizer();
    const writer = new SQLiteAdapter();
    
    await writer.connect({ filepath: config.output_path });
    
    // Extract and process
    let processed = 0;
    const total = config.selected_entities.length;
    
    for await (const rawEntity of connector.extractBatch(config.selected_entities)) {
      // Normalize
      const normalized = normalizer.normalize(rawEntity);
      
      // Write
      await writer.writeBatch('entities', [normalized.entity]);
      await writer.writeBatch('properties', normalized.properties);
      await writer.writeBatch('relations', normalized.relations);
      
      // Update progress
      processed++;
      await updateJob(jobId, {
        progress: Math.floor((processed / total) * 100),
        records_processed: processed
      });
      
      // Send real-time update
      emitProgress(userId, jobId, processed, total);
    }
    
    // Finalize
    await writer.disconnect();
    await updateJob(jobId, {
      status: 'completed',
      completed_at: new Date(),
      progress: 100
    });
    
    // Notify user
    sendNotification(userId, {
      type: 'export_complete',
      job_id: jobId,
      download_url: `/downloads/${jobId}`
    });
    
  } catch (error) {
    await updateJob(jobId, {
      status: 'failed',
      error_message: error.message
    });
    
    sendNotification(userId, {
      type: 'export_failed',
      job_id: jobId,
      error: error.message
    });
  }
}, {
  connection: redisConnection,
  concurrency: 5 // run 5 jobs in parallel
});
```

---

## Data Models & Schema

### Platform Database Schema (PostgreSQL)

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    subscription_tier TEXT DEFAULT 'community', -- community, pro, enterprise
    subscription_expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tier ON users(subscription_tier);
```

#### Connected Accounts Table
```sql
CREATE TABLE connected_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'notion', 'airtable', 'google_sheets'
    platform_account_id TEXT, -- their user/workspace ID on that platform
    platform_account_name TEXT, -- display name
    
    -- Encrypted OAuth credentials
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    
    -- Metadata
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active', -- active, expired, revoked, error
    
    UNIQUE(user_id, platform, platform_account_id)
);

CREATE INDEX idx_connected_accounts_user ON connected_accounts(user_id);
CREATE INDEX idx_connected_accounts_platform ON connected_accounts(platform);
```

#### Migration Jobs Table
```sql
CREATE TABLE migration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Source
    source_platform TEXT NOT NULL,
    source_account_id UUID REFERENCES connected_accounts(id),
    selected_entities JSONB, -- which databases/pages to export
    
    -- Destination
    destination_type TEXT NOT NULL, -- 'sqlite', 'postgresql', 'json', 'csv'
    destination_config JSONB, -- connection details, file paths
    
    -- Job status
    status TEXT DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    progress INTEGER DEFAULT 0, -- 0-100
    
    -- Statistics
    records_total INTEGER,
    records_processed INTEGER DEFAULT 0,
    bytes_downloaded BIGINT DEFAULT 0,
    
    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Results
    output_path TEXT, -- where SQLite file/exports are stored
    download_url TEXT, -- presigned URL for download
    error_message TEXT,
    validation_report JSONB,
    
    -- Configuration
    options JSONB, -- include_attachments, custom_mappings, etc.
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_migration_jobs_user ON migration_jobs(user_id, created_at DESC);
CREATE INDEX idx_migration_jobs_status ON migration_jobs(status) WHERE status IN ('pending', 'running');
CREATE INDEX idx_migration_jobs_platform ON migration_jobs(source_platform);
```

#### Source Schemas Table (Cache)
```sql
CREATE TABLE source_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connected_account_id UUID REFERENCES connected_accounts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    
    -- Cached schema from platform
    schema_data JSONB NOT NULL, -- databases, pages, structure
    
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- cache TTL
    
    UNIQUE(connected_account_id)
);

CREATE INDEX idx_source_schemas_account ON source_schemas(connected_account_id);
```

#### Connectors Table (Metadata)
```sql
CREATE TABLE connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_name TEXT UNIQUE NOT NULL, -- 'notion', 'airtable'
    display_name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    
    version TEXT,
    tier TEXT DEFAULT 'community', -- community, pro, enterprise, custom
    
    -- Capabilities
    capabilities JSONB, -- supports_incremental, supports_relations, supports_attachments
    rate_limits JSONB, -- requests_per_second, daily_limit
    
    -- Documentation
    documentation_url TEXT,
    setup_guide_url TEXT,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_connectors_tier ON connectors(tier);
CREATE INDEX idx_connectors_active ON connectors(is_active) WHERE is_active = true;
```

#### Audit Logs Table (Compliance)
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    job_id UUID REFERENCES migration_jobs(id),
    
    action TEXT NOT NULL, -- 'export_started', 'export_completed', 'data_accessed'
    details JSONB,
    
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_job ON audit_logs(job_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

---

### Universal Schema (User's Destination Database)

This schema is created in the user's SQLite/PostgreSQL database.

#### Entities Table
```sql
CREATE TABLE entities (
    id TEXT PRIMARY KEY,              -- source platform's ID
    entity_type TEXT NOT NULL,        -- 'page', 'database', 'record', 'task'
    title TEXT,                       -- human-readable name
    
    -- Timestamps
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    
    -- Hierarchy
    parent_id TEXT,                   -- self-referential for tree structure
    
    -- Source tracking
    source_platform TEXT NOT NULL,    -- 'notion', 'airtable', 'google_sheets'
    source_url TEXT,                  -- link back to original
    
    -- Platform-specific metadata (preserved as JSON)
    metadata JSONB,
    
    FOREIGN KEY (parent_id) REFERENCES entities(id)
);

CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_parent ON entities(parent_id);
CREATE INDEX idx_entities_platform ON entities(source_platform);
CREATE INDEX idx_entities_created ON entities(created_at);
```

#### Properties Table (EAV Pattern)
```sql
CREATE TABLE properties (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    
    property_name TEXT NOT NULL,      -- "Status", "Due Date", "Owner"
    property_type TEXT NOT NULL,      -- "text", "number", "date", "select", "multi_select"
    
    -- Typed value columns (only one populated per row)
    value_text TEXT,
    value_number NUMERIC,
    value_date TIMESTAMPTZ,
    value_boolean BOOLEAN,
    value_json JSONB,                 -- for complex types (arrays, objects)
    
    position INTEGER DEFAULT 0,       -- for ordering properties
    
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE INDEX idx_properties_entity ON properties(entity_id);
CREATE INDEX idx_properties_name ON properties(property_name);
CREATE INDEX idx_properties_type ON properties(property_type);

-- Composite index for common queries
CREATE INDEX idx_properties_entity_name ON properties(entity_id, property_name);
```

#### Relations Table
```sql
CREATE TABLE relations (
    id TEXT PRIMARY KEY,
    from_entity_id TEXT NOT NULL,
    to_entity_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,      -- 'related_to', 'parent_of', 'assigned_to', 'mentions'
    
    metadata JSONB,                   -- additional context
    
    FOREIGN KEY (from_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (to_entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE INDEX idx_relations_from ON relations(from_entity_id);
CREATE INDEX idx_relations_to ON relations(to_entity_id);
CREATE INDEX idx_relations_type ON relations(relation_type);

-- Prevent duplicate relations
CREATE UNIQUE INDEX idx_relations_unique ON relations(from_entity_id, to_entity_id, relation_type);
```

#### Content Blocks Table (For Rich Text)
```sql
CREATE TABLE content_blocks (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    
    block_type TEXT NOT NULL,         -- 'paragraph', 'heading', 'list', 'code', 'image'
    content TEXT,                     -- plain text content
    position INTEGER NOT NULL,        -- order within parent
    
    -- Hierarchy (blocks can nest)
    parent_block_id TEXT,
    
    -- Formatting and metadata
    metadata JSONB,                   -- styles, colors, language (for code), etc.
    
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_block_id) REFERENCES content_blocks(id) ON DELETE CASCADE
);

CREATE INDEX idx_content_blocks_entity ON content_blocks(entity_id, position);
CREATE INDEX idx_content_blocks_parent ON content_blocks(parent_block_id);
CREATE INDEX idx_content_blocks_type ON content_blocks(block_type);
```

#### Attachments Table
```sql
CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    
    file_name TEXT NOT NULL,
    file_type TEXT,                   -- mime type
    file_size INTEGER,                -- bytes
    
    -- Original source
    source_url TEXT,                  -- original URL from platform
    
    -- Local copy (if downloaded)
    local_path TEXT,
    downloaded_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB,                   -- dimensions for images, duration for videos
    
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_entity ON attachments(entity_id);
CREATE INDEX idx_attachments_type ON attachments(file_type);
```

#### Full-Text Search (SQLite)
```sql
-- Virtual table for full-text search
CREATE VIRTUAL TABLE entities_fts USING fts5(
    title,
    content,  -- aggregated content from properties and blocks
    content='entities',
    content_rowid='rowid'
);

-- Trigger to keep FTS updated
CREATE TRIGGER entities_fts_insert AFTER INSERT ON entities BEGIN
    INSERT INTO entities_fts(rowid, title) VALUES (new.rowid, new.title);
END;

CREATE TRIGGER entities_fts_update AFTER UPDATE ON entities BEGIN
    UPDATE entities_fts SET title = new.title WHERE rowid = new.rowid;
END;

CREATE TRIGGER entities_fts_delete AFTER DELETE ON entities BEGIN
    DELETE FROM entities_fts WHERE rowid = old.rowid;
END;
```

---

### Example Data Flow

**Notion Page → Universal Schema**

**Source (Notion API Response)**:
```json
{
  "object": "page",
  "id": "abc-123-notion",
  "created_time": "2025-01-15T10:00:00.000Z",
  "last_edited_time": "2025-02-01T14:30:00.000Z",
  "properties": {
    "Name": {
      "type": "title",
      "title": [{"plain_text": "Q1 Marketing Plan"}]
    },
    "Status": {
      "type": "select",
      "select": {"name": "In Progress", "color": "blue"}
    },
    "Owner": {
      "type": "people",
      "people": [{"id": "user-456", "name": "Jane Doe"}]
    },
    "Related Projects": {
      "type": "relation",
      "relation": [{"id": "xyz-789-notion"}]
    }
  }
}
```

**Normalized (SQLite)**:

```sql
-- entities table
INSERT INTO entities VALUES (
    'abc-123-notion',
    'page',
    'Q1 Marketing Plan',
    '2025-01-15 10:00:00',
    '2025-02-01 14:30:00',
    NULL,
    'notion',
    'https://notion.so/abc123notion',
    '{"archived": false}'
);

-- properties table
INSERT INTO properties VALUES
    ('prop-1', 'abc-123-notion', 'Name', 'title', 'Q1 Marketing Plan', NULL, NULL, NULL, NULL, 0),
    ('prop-2', 'abc-123-notion', 'Status', 'select', 'In Progress', NULL, NULL, NULL, '{"color": "blue"}', 1);

-- relations table
INSERT INTO relations VALUES (
    'rel-1',
    'abc-123-notion',
    'user-456',
    'assigned_to',
    '{"name": "Jane Doe"}'
);

INSERT INTO relations VALUES (
    'rel-2',
    'abc-123-notion',
    'xyz-789-notion',
    'related_to',
    '{"property_name": "Related Projects"}'
);
```

---

## User Journey & Workflows

### Primary User Flow: First-Time Export

#### Step 1: Sign Up / Sign In

**Community Edition (Self-Hosted)**:
```
User visits http://localhost:3000
    ↓
Creates account (email + password)
    ↓
Email verification (optional for self-hosted)
    ↓
Dashboard
```

**Paid Edition (Cloud)**:
```
User visits app.dataliberation.io
    ↓
Sign up with email or OAuth (Google/GitHub)
    ↓
Choose subscription tier
    ↓
Payment (Stripe)
    ↓
Dashboard
```

#### Step 2: Connect Platform Account

**UI Flow**:
```
Dashboard → "Connect Platform" button
    ↓
Select platform (Notion / Airtable / Google Sheets)
    ↓
OAuth authorization flow
    ↓
Platform redirects back with auth code
    ↓
System exchanges code for access token
    ↓
"Connected: Notion - John's Workspace ✓"
```

**User sees**:
```
┌───────────────────────────────────────────────┐
│ Connected Platforms                           │
├───────────────────────────────────────────────┤
│                                               │
│ ✓ Notion - John's Workspace                  │
│   Connected: Feb 3, 2026                     │
│   Last sync: Never                           │
│   [Export Now] [Disconnect]                  │
│                                               │
│ + Connect Another Platform                   │
│                                               │
└───────────────────────────────────────────────┘
```

#### Step 3: Discover & Select Data

**System discovers schema**:
```
User clicks "Export Now"
    ↓
System fetches workspace structure
    ↓
Shows preview of available data
```

**UI**:
```
┌───────────────────────────────────────────────┐
│ Select Data to Export                         │
├───────────────────────────────────────────────┤
│                                               │
│ ☑ Engineering Wiki (database)                │
│   50 pages • Last updated: Feb 1, 2026       │
│   Est. size: 12 MB                           │
│                                               │
│ ☑ Project Tracker (database)                 │
│   125 records • Last updated: Feb 3, 2026    │
│   Est. size: 5 MB                            │
│                                               │
│ ☐ Personal Notes (pages)                     │
│   200 pages • Last updated: Jan 28, 2026     │
│   Est. size: 45 MB                           │
│                                               │
│ ☐ Include attachments (images, files)        │
│                                               │
│ Total estimated size: 17 MB                   │
│                                               │
│ [Back] [Continue]                            │
└───────────────────────────────────────────────┘
```

#### Step 4: Choose Destination

**UI**:
```
┌───────────────────────────────────────────────┐
│ Choose Export Format                          │
├───────────────────────────────────────────────┤
│                                               │
│ ○ SQLite (Recommended)                       │
│   Single database file, queryable with SQL   │
│   Best for: Complete data ownership          │
│                                               │
│ ○ JSON Files                                 │
│   Structured text files, developer-friendly  │
│   Best for: Programmatic access              │
│                                               │
│ ○ CSV Files                                  │
│   Spreadsheet format, opens in Excel         │
│   Best for: Simple data analysis             │
│                                               │
│ [Pro] ○ PostgreSQL                           │
│   Connect to your own database server        │
│   Best for: Team access, BI tools            │
│                                               │
│ Output location:                             │
│ /Users/john/Downloads/notion-export.db       │
│ [Change Location]                            │
│                                               │
│ [Back] [Start Export]                        │
└───────────────────────────────────────────────┘
```

#### Step 5: Export Progress

**Real-time updates via WebSocket**:

```
┌───────────────────────────────────────────────┐
│ Export in Progress                            │
├───────────────────────────────────────────────┤
│                                               │
│ Status: Extracting data from Notion...       │
│                                               │
│ Progress: ████████████░░░░░░░░ 65%          │
│                                               │
│ • Completed: 97/150 pages                    │
│ • Current: "Project Alpha - Sprint Planning" │
│ • Downloaded: 11.2 MB / 17 MB                │
│                                               │
│ Estimated time remaining: 2 minutes          │
│                                               │
│ [View Logs] [Cancel Export]                  │
│                                               │
└───────────────────────────────────────────────┘
```

#### Step 6: View & Download Results

**Success screen**:

```
┌───────────────────────────────────────────────┐
│ ✓ Export Complete!                           │
├───────────────────────────────────────────────┤
│                                               │
│ Your data has been successfully exported     │
│                                               │
│ Summary:                                     │
│ • 150 pages exported                         │
│ • 125 records exported                       │
│ • 17.3 MB total size                         │
│ • 0 errors                                   │
│                                               │
│ Output file:                                 │
│ notion-export-2026-02-03.db                  │
│                                               │
│ [Download SQLite File]                       │
│ [View Data in Browser]                       │
│ [Export Another Platform]                    │
│                                               │
│ What's next?                                 │
│ • Open the .db file with any SQLite client   │
│ • Query your data with SQL                   │
│ • Import into other tools                    │
│                                               │
│ [View User Guide]                            │
│                                               │
└───────────────────────────────────────────────┘
```

#### Step 7: Browse Liberated Data

**Table view (in-browser)**:

```
┌───────────────────────────────────────────────────────────┐
│ Liberated Data: Notion Export (Feb 3, 2026)              │
├───────────────────────────────────────────────────────────┤
│                                                           │
│ [Table View] [JSON View] [Tree View]    [Export] [Query] │
│                                                           │
│ Entity Type: Pages ▼                                     │
│                                                           │
│ Search: [________________]  Filters: [+Add Filter]       │
│                                                           │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Title              Status      Owner    Updated     │  │
│ ├────────────────────────────────────────────────────┤  │
│ │ Q1 Marketing Plan  In Progress  Jane    Feb 1, 2026│  │
│ │ Sprint Planning    Done         John    Jan 28     │  │
│ │ Architecture Doc   In Review    Sarah   Feb 2      │  │
│ │ Meeting Notes      Draft        John    Feb 3      │  │
│ │ ...                                                 │  │
│ └────────────────────────────────────────────────────┘  │
│                                                           │
│ Showing 4 of 150 results                                 │
│ [← Previous] [Next →]                                    │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

### Advanced Workflows

#### Scheduled Backups (Pro Feature)

```
User navigates to "Scheduled Exports"
    ↓
Clicks "Create Schedule"
    ↓
Configures:
  - Platform: Notion
  - Frequency: Weekly (every Sunday at 2 AM)
  - Destination: ~/Dropbox/backups/notion-{date}.db
  - Notifications: Email when complete
    ↓
System creates recurring job
    ↓
Every week:
  - Job runs automatically
  - Incremental export (only changes since last run)
  - File saved to specified location
  - Email notification sent
```

#### Custom Schema Mapping (Pro Feature)

```
User exports Notion database
    ↓
Clicks "Customize Schema"
    ↓
Visual mapper interface:
  
  Notion Properties  →  Destination Columns
  ─────────────────      ──────────────────
  Name (title)      →    project_name (TEXT)
  Status (select)   →    status (TEXT)
  Due Date (date)   →    deadline (DATE)
  Tags (multi)      →    tags (JSON)
                    
  Add transformation:
  • Status: Map "In Progress" → "active"
  • Due Date: Convert to local timezone
    ↓
Saves template as "Notion Projects"
    ↓
Future exports reuse template
```

#### Team Export (Enterprise Feature)

```
Admin creates shared export configuration
    ↓
Configures:
  - Platform: Airtable (Company Base)
  - Schedule: Daily at midnight
  - Destination: Company PostgreSQL server
  - Permissions: Read-only for team members
    ↓
Team members can:
  - View export history
  - Download exports
  - Query data via company BI tool
    ↓
Audit logs track all access
```

---

## Monetization Strategy

### Pricing Tiers

#### Community Edition (Free Forever)

**Target**: Privacy advocates, students, developers

**Included**:
- ✅ Self-hosted (Docker, manual install)
- ✅ 3-5 core connectors (Notion, Airtable, Google Sheets)
- ✅ Unlimited exports
- ✅ SQLite, JSON, CSV export formats
- ✅ Basic table view UI
- ✅ Community support (GitHub issues, Discord)

**Limitations**:
- ❌ No scheduled/automated exports
- ❌ No PostgreSQL destination
- ❌ No premium connectors
- ❌ No priority support

**Monetization Goal**: Build community, drive adoption, establish trust

---

#### Pro Tier ($29/month or $290/year)

**Target**: Freelancers, power users, small teams (1-5 people)

**Included (All Community Features +)**:
- ✅ **20+ Premium Connectors**:
  - Asana, Monday.com, ClickUp, Linear, Jira
  - Trello, Basecamp, Teamwork
  - Evernote, Bear, Obsidian, Roam Research
  - Coda, Fibery
  - Google Docs, Microsoft OneNote
  - Todoist, Any.do
  - And more...

- ✅ **Advanced Destinations**:
  - PostgreSQL (self-hosted or cloud)
  - MySQL/MariaDB
  - DuckDB (analytics)

- ✅ **Automation**:
  - Scheduled exports (daily, weekly, monthly)
  - Incremental sync (only export changes)
  - Webhook notifications

- ✅ **Enhanced Features**:
  - Custom schema mapping UI
  - Export to multiple destinations simultaneously
  - Larger export limits (1M records, 100GB/month)

- ✅ **Priority Support**:
  - Email support (24-48hr response)
  - Access to feature requests board

**Pricing Justification**:
- Saves hours of manual export work
- Premium connectors require maintenance
- Comparable to 1-2 SaaS subscriptions being replaced

---

#### Enterprise Tier ($299/month or $2,990/year)

**Target**: Companies, teams (5+ people), compliance-driven orgs

**Included (All Pro Features +)**:
- ✅ **Unlimited Connectors**:
  - Access to entire marketplace (50+ platforms)
  - Custom connector development (on request)
  - Priority for new connector requests

- ✅ **Team Features**:
  - Multi-user access with SSO (SAML, Okta)
  - Role-based permissions (admin, editor, viewer)
  - Shared export configurations
  - Team dashboard with all export history

- ✅ **Advanced Capabilities**:
  - Real-time sync (where supported by platform)
  - Data transformation scripts (Python/JavaScript)
  - REST API for programmatic exports
  - Managed hosting option (we run it for you)

- ✅ **Compliance & Security**:
  - SOC 2 Type II compliance
  - GDPR data processing agreement
  - Audit logs with 1-year retention
  - Data encryption at rest and in transit
  - Custom data retention policies

- ✅ **Enterprise Support**:
  - Dedicated support engineer
  - 4-hour response SLA
  - Video onboarding calls
  - Custom deployment assistance
  - Quarterly business reviews

**Pricing Justification**:
- Eliminates vendor lock-in risk for entire company
- Compliance requirements (data sovereignty)
- Disaster recovery / business continuity
- Alternative to expensive enterprise ETL tools

---

### Connector Marketplace (Future)

**Model**: Revenue share with third-party connector developers

```
Community developers build connectors
    ↓
Submit to marketplace for review
    ↓
If approved:
  - Listed as "Verified Connector"
  - Pro/Enterprise users get access
  - Developer gets 50% revenue share
    ↓
Example: 1,000 Pro users × $29/mo = $29k
  Developer share: $14.5k/month (if popular)
```

**Benefits**:
- Rapid connector expansion
- Community-driven platform support
- Sustainable ecosystem

---

### Revenue Projections

**Year 1 (Conservative)**:
- 5,000 community users (free)
- 200 Pro users × $29/mo = $5,800/mo = $69,600/year
- 10 Enterprise users × $299/mo = $2,990/mo = $35,880/year
- **Total ARR: ~$105,000**

**Year 2 (Growth)**:
- 20,000 community users
- 1,000 Pro users × $29/mo = $348,000/year
- 50 Enterprise users × $299/mo = $179,400/year
- **Total ARR: ~$527,400**

**Year 3 (Scale)**:
- 100,000 community users
- 5,000 Pro users × $29/mo = $1,740,000/year
- 250 Enterprise users × $299/mo = $897,000/year
- Marketplace revenue: $200,000/year
- **Total ARR: ~$2,837,000**

---

## Success Metrics

### Product Metrics

#### Acquisition
- **Community downloads**: Track GitHub stars, Docker pulls, npm installs
- **Signups**: New user registrations (for hosted version)
- **Platform connections**: Number of accounts connected
- **Target**: 10,000 community users in Year 1

#### Activation
- **First export completion rate**: % of users who complete first export within 7 days
- **Target**: >60% completion rate
- **Time to first export**: Average minutes from signup to completed export
- **Target**: <15 minutes

#### Engagement
- **Monthly active users**: Users who run at least 1 export per month
- **Exports per user**: Average number of exports
- **Connectors used**: Average platforms connected
- **Target**: 40% monthly active rate

#### Retention
- **30-day retention**: % of users who return after 30 days
- **Target**: >50% for Pro, >30% for Community
- **Churn rate**: Monthly subscription cancellations
- **Target**: <5% monthly churn

#### Revenue
- **Free-to-Paid conversion**: % of community users upgrading to Pro
- **Target**: 4-6% conversion
- **Average revenue per user (ARPU)**: Total revenue / active users
- **Lifetime value (LTV)**: Average revenue per customer over lifetime
- **Target LTV**: $400+ for Pro, $5,000+ for Enterprise

#### Product Quality
- **Export success rate**: % of jobs that complete without errors
- **Target**: >95% success rate
- **Data completeness**: % of source data successfully exported
- **Target**: 100% (with validation reports)
- **Average export time**: Time to complete typical export
- **Target**: <5 minutes for 10k records

### Technical Metrics

#### Performance
- **API response time**: p95 latency for API endpoints
- **Target**: <200ms for reads, <500ms for writes
- **Job processing time**: Time from job creation to completion
- **Target**: <10 minutes for typical export (10k records)
- **Throughput**: Jobs processed per hour
- **Target**: 100+ jobs/hour with 5 workers

#### Reliability
- **Uptime**: System availability
- **Target**: 99.9% uptime (hosted version)
- **Error rate**: % of requests that result in errors
- **Target**: <0.1% error rate
- **Job failure rate**: % of export jobs that fail
- **Target**: <5% failure rate

#### Scalability
- **Concurrent users**: Peak simultaneous users
- **Database size**: Platform DB growth rate
- **Worker capacity**: Number of parallel jobs

### Community Metrics

#### Open Source Health
- **GitHub stars**: Community interest indicator
- **Target**: 1,000 stars in Year 1
- **Contributors**: Active code contributors
- **Target**: 10+ contributors in Year 1
- **Pull requests**: Community contributions
- **Issues resolved**: Community support activity

#### Support Quality
- **Response time**: Average time to first response
- **Target**: <24 hours for Pro, <4 hours for Enterprise
- **Resolution time**: Average time to resolve issues
- **Target**: <3 days for Pro, <1 day for Enterprise
- **Customer satisfaction (CSAT)**: Support rating
- **Target**: >4.5/5 stars

---

## Technical Requirements

### Functional Requirements

#### FR-1: User Authentication & Authorization
- Users must be able to create accounts with email/password
- Support OAuth login (Google, GitHub) for hosted version
- Role-based access control (Community, Pro, Enterprise, Admin)
- Session management with JWT tokens
- Password reset functionality

#### FR-2: Platform Connection Management
- Users must be able to connect third-party platform accounts via OAuth 2.0
- System must securely store and encrypt OAuth tokens
- Support token refresh when expired
- Allow users to disconnect platforms
- Show connection status and last sync time

#### FR-3: Data Discovery
- System must fetch and display available data structures from connected platforms
- Show preview: number of entities, estimated size
- Allow users to select specific databases/pages/folders to export
- Cache schema for performance (with TTL)

#### FR-4: Data Extraction
- Extract complete data sets via platform APIs
- Respect rate limits with exponential backoff
- Support pagination for large datasets
- Handle API errors gracefully with retry logic
- Download attachments (optional, user-configurable)
- Track extraction progress in real-time

#### FR-5: Data Transformation
- Parse platform-specific data structures
- Normalize to universal schema (entities, properties, relations)
- Preserve all metadata and relations
- Handle data type conversions
- Validate data integrity with checksums

#### FR-6: Data Loading
- Write normalized data to user's chosen destination
- Support transactional writes (rollback on failure)
- Batch inserts for performance (1000 records/batch)
- Create indexes for optimal query performance
- Generate validation report

#### FR-7: Destination Support
- **SQLite**: Single file database (default)
- **PostgreSQL**: Remote database connection
- **JSON**: Structured file exports
- **CSV**: Flat file exports per table
- **Markdown**: For Notion pages (preserves formatting)

#### FR-8: Data Presentation
- **Table View**: Spreadsheet-like interface with sorting, filtering, search
- **JSON View**: Raw structured data display
- **Tree View**: Hierarchical entity browser
- **Export Options**: Download as CSV, JSON, SQL dump

#### FR-9: Job Management
- Create export jobs with configuration
- Queue jobs for asynchronous processing
- Real-time progress updates via WebSocket
- Allow pause/resume of long-running jobs
- Cancel jobs in progress
- Retry failed jobs
- Job history and logs

#### FR-10: Scheduled Exports (Pro)
- Create recurring export schedules (daily, weekly, monthly)
- Incremental sync (only export changes)
- Email notifications on completion/failure
- Webhook notifications

#### FR-11: Custom Schema Mapping (Pro)
- Visual interface for field mapping
- Define transformation rules
- Save templates for reuse
- Preview transformed data before export

#### FR-12: Team Features (Enterprise)
- Multi-user accounts with role-based permissions
- Shared export configurations
- Team dashboard with all export history
- SSO integration (SAML, Okta)

#### FR-13: API Access (Enterprise)
- REST API for programmatic export triggers
- API authentication with tokens
- Rate limiting per customer
- API documentation (OpenAPI/Swagger)

### Non-Functional Requirements

#### NFR-1: Performance
- API response time <200ms (p95) for reads
- API response time <500ms (p95) for writes
- Export job completion <10 minutes for 10k records
- Support 100+ concurrent jobs
- Database queries <100ms (p95)

#### NFR-2: Scalability
- Support 100,000+ users
- Support 10,000+ concurrent exports
- Horizontal scaling of API servers
- Horizontal scaling of job workers
- Database sharding for platform DB if needed

#### NFR-3: Reliability
- 99.9% uptime for hosted version
- <0.1% error rate for API requests
- <5% job failure rate
- Automatic retry for transient failures
- Graceful degradation when dependencies fail

#### NFR-4: Security
- OAuth 2.0 for platform authentication
- Encrypted token storage (AES-256)
- HTTPS only (TLS 1.3)
- SQL injection prevention (parameterized queries)
- XSS prevention (CSP headers, input sanitization)
- CSRF protection (tokens)
- Rate limiting (prevent abuse)
- Security headers (HSTS, X-Frame-Options)

#### NFR-5: Data Privacy
- Users own their exported data (no retention)
- Temporary data deleted after export completes
- No analytics/tracking without consent
- GDPR compliant (data portability, deletion)
- SOC 2 Type II (Enterprise)

#### NFR-6: Usability
- Intuitive UI requiring no technical knowledge
- Clear error messages with actionable guidance
- Progress indicators for long operations
- Responsive design (mobile, tablet, desktop)
- Accessibility (WCAG 2.1 AA)

#### NFR-7: Maintainability
- Modular architecture (easy to add connectors)
- Comprehensive test coverage (>80%)
- Documented code and APIs
- Structured logging for debugging
- Monitoring and alerting

#### NFR-8: Compatibility
- Support latest 2 versions of Chrome, Firefox, Safari, Edge
- Docker deployment (Linux, macOS, Windows)
- Node.js 20+ or Python 3.11+
- PostgreSQL 16+
- Redis 7+

---

## Security & Compliance

### Security Architecture

#### Authentication & Authorization
```
User Layer
    ↓
JWT Token Validation
    ↓
Role-Based Access Control
    ↓
API Endpoints
    ↓
Database Access
```

**Implemented Security**:
- Passwords hashed with bcrypt (cost: 12)
- JWT tokens with 24-hour expiration
- Refresh tokens for seamless re-auth
- Rate limiting: 100 requests/minute per user
- Account lockout after 5 failed login attempts

#### Data Encryption

**In Transit**:
- TLS 1.3 for all connections
- HTTPS only (HSTS headers)
- Certificate pinning for mobile apps

**At Rest**:
- OAuth tokens encrypted with AES-256
- Database encryption (PostgreSQL native encryption)
- Encrypted backups

#### API Security

**Input Validation**:
- Strict schema validation (Zod/Joi)
- SQL injection prevention (parameterized queries)
- XSS prevention (CSP headers, sanitization)
- File upload validation (type, size limits)

**Output Security**:
- No sensitive data in logs
- Redacted error messages (hide internals)
- CORS policies (whitelist only)

#### Infrastructure Security

**Network**:
- VPC with private subnets (hosted version)
- Firewall rules (least privilege)
- DDoS protection (Cloudflare)

**Access Control**:
- SSH key-only access (no passwords)
- Bastion hosts for database access
- Audit logs for all admin actions

### Compliance

#### GDPR (General Data Protection Regulation)

**User Rights**:
1. **Right to Access**: Users can export their account data
2. **Right to Deletion**: Users can delete their account and all data
3. **Right to Portability**: Users can export data in machine-readable formats
4. **Right to Rectification**: Users can update their information

**Implementation**:
- Privacy policy clearly states data usage
- Consent checkboxes for optional features
- Data retention policies (logs: 90 days, exports: immediate deletion)
- DPA (Data Processing Agreement) for Enterprise customers

#### SOC 2 Type II (Enterprise Only)

**Trust Service Criteria**:
1. **Security**: Access controls, encryption, monitoring
2. **Availability**: 99.9% uptime, disaster recovery
3. **Processing Integrity**: Data validation, checksums
4. **Confidentiality**: Encrypted storage, access logs
5. **Privacy**: GDPR compliance, user controls

**Audit Requirements**:
- Annual SOC 2 audit by independent firm
- Penetration testing (quarterly)
- Vulnerability scanning (weekly)
- Incident response plan (documented, tested)

#### Data Residency

**Geographic Controls (Enterprise)**:
- Choose data center region (US, EU, Asia)
- Data never leaves chosen region
- Compliance with local laws (GDPR, CCPA)

### Vulnerability Management

**Process**:
1. **Dependency Scanning**: Automated checks (Snyk, Dependabot)
2. **Code Scanning**: Static analysis (SonarQube)
3. **Penetration Testing**: Quarterly external audits
4. **Bug Bounty**: Responsible disclosure program

**Response**:
- Critical vulnerabilities patched within 24 hours
- High severity within 7 days
- Security advisories published on GitHub

---

## Roadmap

### Phase 1: MVP (Months 1-3)

**Goal**: Launch Community Edition with core functionality

**Features**:
- ✅ User authentication (email/password)
- ✅ 3 connectors: Notion, Airtable, Google Sheets
- ✅ SQLite export (universal schema)
- ✅ Basic table view UI
- ✅ Job queue system
- ✅ Docker deployment
- ✅ Documentation and setup guide

**Launch**:
- Open source on GitHub
- Product Hunt launch
- Share on Hacker News, r/selfhosted
- Blog post: "Take Back Your Data"

---

### Phase 2: Pro Features (Months 4-6)

**Goal**: Launch paid tier with advanced features

**Features**:
- ✅ Stripe payment integration
- ✅ 10+ additional connectors (Asana, Trello, Jira, etc.)
- ✅ PostgreSQL export
- ✅ Scheduled exports
- ✅ Incremental sync
- ✅ Custom schema mapping UI
- ✅ Email notifications
- ✅ Priority support system

**Marketing**:
- Case studies from early users
- Comparison guides (vs. Airbyte, vs. platform exports)
- Content marketing (SEO-optimized articles)

---

### Phase 3: Scale & Polish (Months 7-9)

**Goal**: Improve performance, reliability, UX

**Features**:
- ✅ Performance optimizations (10x faster exports)
- ✅ Advanced filtering and search
- ✅ Data visualization (charts, graphs)
- ✅ Batch export (multiple platforms at once)
- ✅ CLI tool (for power users)
- ✅ Mobile app (iOS/Android) - view exports on the go
- ✅ Improved documentation and tutorials

**Infrastructure**:
- Monitoring and alerting (Prometheus, Grafana)
- Automated testing (>80% coverage)
- CI/CD pipeline improvements

---

### Phase 4: Enterprise & Marketplace (Months 10-12)

**Goal**: Launch Enterprise tier and connector marketplace

**Features**:
- ✅ Multi-user accounts with SSO
- ✅ Role-based permissions
- ✅ Team dashboard
- ✅ Audit logs (1-year retention)
- ✅ REST API for programmatic access
- ✅ Connector marketplace (revenue share)
- ✅ Custom connector development service
- ✅ Managed hosting option

**Compliance**:
- SOC 2 Type II audit
- GDPR compliance certification
- Security penetration testing

---

### Future Vision (Year 2+)

**Advanced Features**:
- Real-time sync (webhooks where available)
- Data transformation scripts (Python/JS)
- Cross-platform data consolidation (merge from multiple sources)
- AI-powered schema mapping (auto-detect field relationships)
- Graph visualization (entity relationships)
- Version control for exports (Git-like diffs)

**Platform Expansion**:
- Browser extension (export from any web app)
- Desktop app (Electron) for offline use
- Integration with BI tools (Metabase, Grafana)
- Plugin system for custom destinations
- Zapier/Make.com integration

**Community Growth**:
- Connector developer certification program
- Annual conference (Data Liberation Summit)
- Open-source bounties for features
- Educational resources (courses, workshops)

---

## Open Questions & Risks

### Open Questions

#### Product

1. **Attachment Handling**: Should we download and store attachments by default, or only on request?
   - **Tradeoff**: Completeness vs. storage/bandwidth costs
   - **Recommendation**: Make it optional with clear warnings about size

2. **Incremental Sync Strategy**: How to detect changes efficiently?
   - **Options**: 
     - Timestamp-based (last_modified_at)
     - Checksum comparison (hash of content)
     - Platform webhooks (if available)
   - **Recommendation**: Timestamp + checksum fallback

3. **Data Retention**: How long to keep exported files on server (for hosted version)?
   - **Options**: 
     - 7 days (user must download)
     - 30 days (convenience)
     - Forever (storage costs)
   - **Recommendation**: 30 days for Pro, 7 days for Community

4. **Conflict Resolution**: If user re-exports same data, should we:
   - Overwrite
   - Create new version
   - Merge changes
   - **Recommendation**: Create new version with timestamp suffix

#### Technical

1. **Database Choice for Platform**: PostgreSQL or MySQL?
   - **Decision**: PostgreSQL for JSONB support

2. **Queue System**: Redis + BullMQ or RabbitMQ?
   - **Decision**: Redis + BullMQ (simpler, less infrastructure)

3. **File Storage**: Local filesystem or S3?
   - **Self-hosted**: Local filesystem
   - **Hosted**: S3 or S3-compatible (MinIO)

4. **Real-time Updates**: WebSocket or Server-Sent Events (SSE)?
   - **Decision**: WebSocket for bi-directional communication

#### Business

1. **Freemium vs. Free Trial**: Should Community Edition be truly free, or a limited trial?
   - **Decision**: Truly free (open source) to build trust and community

2. **Connector Pricing**: Should premium connectors be individually priced or bundled?
   - **Decision**: Bundled in Pro tier (simpler, better value perception)

3. **Marketplace Revenue Share**: What split with third-party connector developers?
   - **Options**: 50/50, 70/30 (platform/developer)
   - **Recommendation**: 50/50 to incentivize quality connectors

### Risks & Mitigation

#### Technical Risks

**Risk 1: Platform API Changes**
- **Impact**: Connectors break when platforms update APIs
- **Likelihood**: High (APIs change frequently)
- **Mitigation**:
  - Version connectors (separate versions for API v1, v2)
  - Monitor platform changelog/announcements
  - Automated tests against platform sandbox environments
  - Graceful degradation (warn users of incompatibility)

**Risk 2: Rate Limiting**
- **Impact**: Large exports fail or take very long
- **Likelihood**: Medium (platforms enforce strict limits)
- **Mitigation**:
  - Respect rate limits with exponential backoff
  - Batch requests efficiently
  - Offer "slow mode" for large exports (overnight)
  - Notify users of estimated time upfront

**Risk 3: Data Loss During Export**
- **Impact**: Incomplete or corrupted exports
- **Likelihood**: Low (with proper error handling)
- **Mitigation**:
  - Transactional writes (rollback on failure)
  - Checksum validation
  - Retry logic for transient failures
  - Keep raw staging data until export confirmed successful

**Risk 4: Scalability Bottlenecks**
- **Impact**: System slows down or crashes under load
- **Likelihood**: Medium (as user base grows)
- **Mitigation**:
  - Horizontal scaling of API and workers
  - Database read replicas
  - Caching (Redis) for frequently accessed data
  - Load testing before launch

#### Business Risks

**Risk 1: Platform Terms of Service Violations**
- **Impact**: Platforms ban or restrict API access
- **Likelihood**: Medium (platforms may not like data exports)
- **Mitigation**:
  - Use official APIs only (no scraping)
  - Respect rate limits and ToS
  - Frame as "backup/portability" not "competitor"
  - Legal review of all connector implementations

**Risk 2: Low Conversion to Paid**
- **Impact**: Insufficient revenue to sustain development
- **Likelihood**: Medium (freemium is hard)
- **Mitigation**:
  - Provide genuine value in Community Edition (build trust)
  - Make Pro tier a clear upgrade (not a paywall)
  - Focus on power users and businesses (higher willingness to pay)
  - Offer annual discounts to increase LTV

**Risk 3: Competitor with More Resources**
- **Impact**: Well-funded competitor launches similar product
- **Likelihood**: Medium (market opportunity is clear)
- **Mitigation**:
  - Focus on open-source community (hard to replicate)
  - Build trust through transparency (no one does this well)
  - Fast iteration (stay ahead on features)
  - Strong brand positioning (data liberation, not integration)

**Risk 4: Regulatory Changes**
- **Impact**: New laws restrict data portability or API access
- **Likelihood**: Low (trend is toward more portability)
- **Mitigation**:
  - Monitor regulatory landscape (GDPR, CCPA trends)
  - Legal counsel on retainer
  - Compliance-first approach (SOC 2, GDPR)
  - Geographic flexibility (data residency options)

#### Market Risks

**Risk 1: Platforms Improve Native Export**
- **Impact**: Less need for third-party tool
- **Likelihood**: Low (platforms don't want users to leave)
- **Mitigation**:
  - We'll always be better (unified format, queryable DBs)
  - Focus on multi-platform consolidation
  - Add value beyond export (analytics, visualization)

**Risk 2: Slow Adoption**
- **Impact**: Not enough users to achieve scale
- **Likelihood**: Medium (niche problem, education required)
- **Mitigation**:
  - Content marketing (educate on vendor lock-in)
  - Target early adopters (privacy advocates, self-hosters)
  - Partnerships with related tools (Obsidian, Logseq)
  - PR: stories of platform shutdowns/rug-pulls

---

## Appendix

### Technical Stack Summary

**Frontend**:
- Framework: Next.js 14 (App Router)
- UI Library: Shadcn/ui + Radix UI
- Styling: TailwindCSS
- State Management: Zustand
- Data Fetching: TanStack Query (React Query)
- WebSocket: Socket.io-client
- Charts: Recharts
- Tables: TanStack Table

**Backend**:
- Runtime: Node.js 20 (TypeScript)
- Framework: NestJS or Fastify
- API: REST + GraphQL (optional)
- Real-time: Socket.io

**Alternative Backend**:
- Runtime: Python 3.11
- Framework: FastAPI
- ORM: SQLAlchemy
- Async: asyncio

**Databases**:
- Platform DB: PostgreSQL 16
- Cache/Queue: Redis 7
- User Destination: SQLite 3.x, PostgreSQL, etc.

**Job Queue**:
- BullMQ (Redis-based)
- Workers: Separate processes for job execution

**Infrastructure**:
- Containerization: Docker + Docker Compose
- Orchestration: Kubernetes (optional, for scale)
- Monitoring: Prometheus + Grafana
- Logging: Winston (Node) or structlog (Python)
- Error Tracking: Sentry

**Deployment**:
- Self-hosted: Docker Compose
- Cloud (hosted version): AWS/GCP/DigitalOcean
- CDN: Cloudflare
- Storage: S3 or S3-compatible (MinIO)

### Glossary

**Terms**:
- **Entity**: A piece of content in a platform (page, record, task, document)
- **Property**: A field/attribute of an entity (title, status, due date)
- **Relation**: A link between two entities (parent-child, reference, assignment)
- **Connector**: A plugin that extracts data from a specific platform
- **Adapter**: A plugin that writes data to a specific destination
- **Universal Schema**: Normalized database structure that works across platforms
- **Migration Job**: An export task that moves data from source to destination
- **Incremental Sync**: Exporting only changes since the last export
- **Data Liberation**: The philosophy of users owning and controlling their data

**Acronyms**:
- **API**: Application Programming Interface
- **OAuth**: Open Authorization (authentication protocol)
- **JWT**: JSON Web Token
- **EAV**: Entity-Attribute-Value (database design pattern)
- **ETL**: Extract, Transform, Load (data pipeline pattern)
- **GDPR**: General Data Protection Regulation
- **SOC 2**: Service Organization Control 2 (audit standard)
- **LTV**: Lifetime Value (customer metric)
- **ARPU**: Average Revenue Per User
- **SLA**: Service Level Agreement

---

## Document Control

**Version History**:

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | Feb 3, 2026 | Product Team | Initial draft |
| 1.0 | Feb 3, 2026 | Product Team | Complete PRD with architecture |

**Review Status**: ✅ Draft Complete

**Next Steps**:
1. Technical review by Engineering team
2. Business review by Leadership
3. Legal review (ToS, privacy policy)
4. Approval and kickoff

---

**END OF PRD**
