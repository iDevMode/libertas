# Standard Operating Procedures (SOP)
# Data Liberation Platform

**Version:** 1.0  
**Date:** February 3, 2026  
**Document Owner:** Operations Team  
**Status:** Draft

---

## Table of Contents

1. [Document Overview](#document-overview)
2. [Development Procedures](#development-procedures)
3. [Connector Development](#connector-development)
4. [Deployment Procedures](#deployment-procedures)
5. [Database Management](#database-management)
6. [Job Queue Operations](#job-queue-operations)
7. [Monitoring & Alerting](#monitoring--alerting)
8. [Incident Response](#incident-response)
9. [User Support](#user-support)
10. [Security Procedures](#security-procedures)
11. [Backup & Recovery](#backup--recovery)
12. [Release Management](#release-management)

---

## Document Overview

### Purpose
This SOP provides detailed operational procedures for the Data Liberation Platform.

### Scope
Covers development, deployment, operations, support, and security procedures.

### Audience
- Engineering Team
- Operations Team  
- Support Team
- Security Team

---

## Development Procedures

### DEV-001: Development Environment Setup

**Prerequisites:**
- Git, Docker Desktop installed
- macOS, Linux, or WSL2

**Steps:**

1. Clone repository:
```bash
git clone https://github.com/data-liberation/platform.git
cd platform
```

2. Install dependencies:
```bash
cd backend && npm install
cd ../frontend && npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your values
```

4. Start services:
```bash
docker-compose up -d postgres redis
npm run migrate
npm run dev
```

5. Verify: http://localhost:3000

---

### DEV-002: Code Contribution Workflow

**Branch Naming:**
- `feature/` - New features
- `fix/` - Bug fixes  
- `refactor/` - Code refactoring
- `docs/` - Documentation

**Process:**

1. Create branch:
```bash
git checkout -b feature/your-feature
```

2. Make changes and test:
```bash
npm test
npm run lint
```

3. Commit (Conventional Commits):
```bash
git commit -m "feat: add Asana connector"
```

4. Push and create PR:
```bash
git push origin feature/your-feature
```

5. Address review feedback

6. Merge when approved

---

### DEV-003: Coding Standards

**TypeScript/JavaScript:**
- ESLint + Prettier
- 2-space indentation  
- camelCase for variables/functions
- PascalCase for classes
- UPPER_SNAKE_CASE for constants

**Python:**
- Follow PEP 8
- Black formatter
- 4-space indentation
- Type hints required

**Best Practices:**
- Functions <50 lines
- Explicit error handling
- Avoid `any` in TypeScript
- Write tests for new code

---

### DEV-004: Testing Requirements

**Coverage:** Minimum 80%

**Test Types:**
1. Unit Tests: Individual functions
2. Integration Tests: Component interactions  
3. E2E Tests: Full user workflows
4. Connector Tests: API integrations

**Running Tests:**
```bash
npm test                 # All tests
npm run test:coverage    # Coverage report
npm run test:integration # Integration only
```

**Writing Tests (Example):**
```typescript
describe('UserService', () => {
  it('should create user with valid data', async () => {
    const user = await userService.createUser({
      email: 'test@example.com',
      password: 'SecurePass123!'
    });
    
    expect(user).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
});
```

---

## Connector Development

### CONN-001: Creating New Connector

**Steps:**

1. Research platform API documentation

2. Create connector scaffold:
```bash
npm run generate:connector -- --name="PlatformName"
```

3. Implement connector interface:
```typescript
export class PlatformConnector implements IConnector {
  async authenticate(credentials) { ... }
  async discoverSchema() { ... }
  async extractEntity(id) { ... }
  async *extractBatch(ids) { ... }
  getRateLimits() { ... }
  getCapabilities() { ... }
}
```

4. Implement normalizer:
```typescript
export class PlatformNormalizer {
  normalizeEntity(raw) { ... }
  normalizeProperty(raw) { ... }
  normalizeRelation(raw) { ... }
}
```

5. Write comprehensive tests

6. Add to connector registry

7. Create documentation

8. Test with real data

9. Submit PR for review

---

### CONN-002: Connector Testing

**Test Levels:**

1. **Unit Tests** - Mock API, test logic
2. **Integration Tests** - Sandbox environment
3. **Manual Tests** - Real user data

**Checklist:**
- ✅ OAuth connection works
- ✅ Schema discovery complete
- ✅ Sample export successful  
- ✅ Large export (10k+ records)
- ✅ Error handling works
- ✅ Rate limits respected
- ✅ Edge cases covered

**Approval:** All tests pass + manual sign-off

---

## Deployment Procedures

### DEPLOY-001: Local Development

```bash
# Start infrastructure
docker-compose up -d postgres redis

# Run migrations
npm run migrate

# Start servers
npm run dev  # Backend
cd frontend && npm run dev  # Frontend
```

**Verify:**
- Frontend: http://localhost:3000
- API: http://localhost:8000/api/health

---

### DEPLOY-002: Production Deployment

**Prerequisites:**
- Linux server (Ubuntu 22.04+)
- Docker, Docker Compose
- Domain with SSL certificate

**Steps:**

1. Prepare server:
```bash
ssh user@server
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
```

2. Clone and configure:
```bash
git clone https://github.com/data-liberation/platform.git
cd platform
cp .env.example .env.production
# Edit .env.production
```

3. Deploy:
```bash
docker-compose -f docker-compose.prod.yml up -d --build
docker-compose exec backend npm run migrate
```

4. Configure Nginx with SSL

5. Verify deployment:
```bash
curl https://app.dataliberation.io/api/health
```

---

### DEPLOY-003: Database Migration

**Process:**

1. Review migration:
```bash
npm run migrate:status
```

2. Test in staging

3. Backup production:
```bash
./scripts/backup-database.sh
```

4. Apply migration:
```bash
docker-compose exec backend npm run migrate
```

5. Verify and monitor

**Rollback if needed:**
```bash
docker-compose exec backend npm run migrate:rollback
# Or restore from backup
```

---

## Database Management

### DB-001: Maintenance Tasks

**Frequency:** Weekly (automated)

**Tasks:**

1. Analyze tables:
```sql
ANALYZE VERBOSE;
```

2. Vacuum database:
```sql
VACUUM ANALYZE;
```

3. Reindex:
```sql
REINDEX DATABASE data_liberator;
```

4. Check slow queries:
```sql
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

### DB-002: Monitoring

**Key Metrics:**

1. Connection pool usage
2. Database size growth
3. Table sizes  
4. Index usage
5. Cache hit ratio (>95%)

**Alert Thresholds:**
- Connection pool >80% → Warning
- Cache hit <95% → Investigate
- Long queries >5min → Alert

---

## Job Queue Operations

### QUEUE-001: Monitoring

**Metrics:**
- Queue length
- Active jobs
- Failed jobs  
- Processing rate

**Daily Checks:**
- No jobs stuck >2 hours
- Failed rate <5%
- Queue length <1000

**Troubleshooting:**
```bash
# Check workers
docker-compose ps worker

# View logs
docker-compose logs -f worker

# Restart if needed
docker-compose restart worker
```

---

### QUEUE-002: Scaling Workers

**When to Scale:**
- Queue length >500
- Wait time >30 minutes

**Horizontal Scaling:**
```bash
docker-compose up -d --scale worker=5
```

**Monitor impact for 24 hours**

---

## Monitoring & Alerting

### MON-001: System Monitoring

**Tools:**
- Prometheus (metrics)
- Grafana (dashboards)
- AlertManager (alerts)

**Key Dashboards:**
- Platform Overview
- API Performance
- Database Metrics
- Worker Utilization

**Alert Rules:**
- API Down (critical)
- High Error Rate (warning)
- DB Pool Full (warning)
- Queue Backlog (warning)

---

### MON-002: Alert Response

**Severity Levels:**

**Critical** - Immediate response
- System down
- Data loss risk

**Warning** - 1 hour response  
- Degraded performance
- Resource constraints

**Info** - Business hours
- Trends
- Reminders

**Response Process:**
1. Acknowledge alert
2. Assess severity
3. Communicate status
4. Investigate
5. Mitigate
6. Resolve
7. Post-incident review

---

## Incident Response

### INC-001: Incident Management

**Severity:**

**SEV-1 (Critical)**
- Complete outage
- Response: Immediate

**SEV-2 (Major)**
- Partial outage
- Response: 1 hour

**SEV-3 (Minor)**
- Non-critical feature down
- Response: 4 hours

**Process:**
1. Detection
2. Acknowledgment  
3. Assessment
4. Communication
5. Investigation
6. Mitigation
7. Resolution
8. Post-incident review

**Incident Report includes:**
- Timeline
- Impact
- Root cause
- Resolution
- Lessons learned
- Action items

---

## User Support

### SUPPORT-001: Ticket Workflow

**Channels:**
- Email: support@dataliberation.io
- In-app chat (Pro/Enterprise)
- GitHub issues (Community)

**Priority:**

**P0 (Critical)** - 1hr response
- Account access issues
- Data loss

**P1 (High)** - 4hr response
- Export failures  
- Connector errors

**P2 (Medium)** - 24hr response
- Feature requests
- General questions

**P3 (Low)** - 3 day response
- Documentation
- Nice-to-haves

**Resolution Process:**
1. Verify issue
2. Gather information
3. Investigate
4. Resolve
5. Follow-up

---

## Security Procedures

### SEC-001: Security Incidents

**Types:**
- Unauthorized access
- Data breach
- DDoS attack
- Vulnerability

**Response:**
1. Contain
2. Assess  
3. Notify
4. Remediate
5. Document

**User Notification:**
- What happened
- Data involved
- Actions taken
- User actions needed

---

### SEC-002: Vulnerability Management

**Process:**

1. Acknowledge (24hrs)
2. Assess severity (CVSS)
3. Develop fix
4. Deploy
5. Disclose

**Severity:**
- Critical (9.0-10.0)
- High (7.0-8.9)
- Medium (4.0-6.9)
- Low (0.1-3.9)

---

## Backup & Recovery

### BACKUP-001: Database Backup

**Schedule:**
- Full backup: Daily at 2 AM
- Incremental: Every 6 hours
- Retention: 30 days

**Procedure:**
```bash
# Automated via cron
./scripts/backup-database.sh

# Uploads to S3
# Deletes local copies >7 days
```

**Verify weekly:**
```bash
# Restore to test environment
# Verify data integrity
```

---

### BACKUP-002: Disaster Recovery

**Objectives:**
- RTO: 4 hours
- RPO: 6 hours

**Process:**

1. Assess damage
2. Provision infrastructure
3. Restore database
4. Deploy application
5. Verify integrity
6. Update DNS (if needed)
7. Communicate

**Test annually**

---

## Release Management

### RELEASE-001: Version Release

**Types:**
- Major (v2.0.0): Breaking changes
- Minor (v1.1.0): New features
- Patch (v1.0.1): Bug fixes

**Process:**

1. Create release branch
2. Update version
3. Test thoroughly
4. Merge to main
5. Tag release
6. Deploy to production
7. Verify
8. Announce

**Rollback if issues:**
```bash
git checkout previous-version
docker-compose up -d --build
npm run migrate:rollback
```

---

## Document Control

**Version:** 1.0  
**Last Updated:** February 3, 2026  
**Next Review:** May 3, 2026  

**Approval:**
- Engineering Lead: _______
- Operations Lead: _______
- Security Lead: _______

---

**END OF SOP**
