import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed connectors
  const connectors = [
    {
      platformName: 'notion',
      displayName: 'Notion',
      description: 'Export pages, databases, and blocks from Notion workspaces',
      tier: 'community',
      capabilities: {
        supportsIncrementalSync: true,
        supportsRelations: true,
        supportsAttachments: true,
        supportsComments: true,
        supportsRichText: true,
        supportsFullExport: true,
        maxPageSize: 100,
      },
      rateLimits: {
        requestsPerSecond: 3,
        burstSize: 10,
      },
      documentationUrl: 'https://developers.notion.com/',
      isActive: true,
    },
    {
      platformName: 'airtable',
      displayName: 'Airtable',
      description: 'Export bases, tables, and records from Airtable',
      tier: 'community',
      capabilities: {
        supportsIncrementalSync: false,
        supportsRelations: true,
        supportsAttachments: true,
        supportsComments: true,
        supportsRichText: false,
        supportsFullExport: true,
        maxPageSize: 100,
      },
      rateLimits: {
        requestsPerSecond: 5,
        burstSize: 10,
      },
      documentationUrl: 'https://airtable.com/developers/web/api/introduction',
      isActive: true,
    },
    {
      platformName: 'google_sheets',
      displayName: 'Google Sheets',
      description: 'Export spreadsheets and worksheets from Google Sheets',
      tier: 'community',
      capabilities: {
        supportsIncrementalSync: false,
        supportsRelations: false,
        supportsAttachments: false,
        supportsComments: false,
        supportsRichText: false,
        supportsFullExport: true,
        maxPageSize: 1000,
      },
      rateLimits: {
        requestsPerSecond: 1,
        burstSize: 60,
        dailyLimit: 500,
      },
      documentationUrl: 'https://developers.google.com/sheets/api',
      isActive: true,
    },
  ];

  for (const connector of connectors) {
    await prisma.connector.upsert({
      where: { platformName: connector.platformName },
      update: connector,
      create: connector,
    });
    console.log(`  Created/updated connector: ${connector.displayName}`);
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
