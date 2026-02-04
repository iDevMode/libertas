/**
 * Script to create test databases in Notion for testing relational export
 * Run with: npx tsx scripts/create-test-databases.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

async function makeNotionRequest(accessToken: string, endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Notion API error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

async function findParentPage(accessToken: string): Promise<string> {
  // Search for any page we can use as a parent
  const result = await makeNotionRequest(accessToken, '/search', {
    method: 'POST',
    body: JSON.stringify({
      filter: { property: 'object', value: 'page' },
      page_size: 1,
    }),
  });

  if (result.results.length === 0) {
    throw new Error('No pages found in Notion workspace. Please create at least one page first.');
  }

  return result.results[0].id;
}

async function createProjectsDatabase(accessToken: string, parentPageId: string): Promise<string> {
  console.log('Creating Projects database...');

  const result = await makeNotionRequest(accessToken, '/databases', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: parentPageId },
      title: [{ type: 'text', text: { content: 'Test Projects' } }],
      properties: {
        'Name': { title: {} },
        'Status': {
          select: {
            options: [
              { name: 'Planning', color: 'gray' },
              { name: 'In Progress', color: 'blue' },
              { name: 'Completed', color: 'green' },
            ],
          },
        },
        'Priority': {
          select: {
            options: [
              { name: 'Low', color: 'gray' },
              { name: 'Medium', color: 'yellow' },
              { name: 'High', color: 'red' },
            ],
          },
        },
        'Start Date': { date: {} },
        'Budget': { number: { format: 'dollar' } },
      },
    }),
  });

  console.log(`  Created Projects database: ${result.id}`);
  return result.id;
}

async function createTasksDatabase(accessToken: string, parentPageId: string, projectsDbId: string): Promise<string> {
  console.log('Creating Tasks database...');

  const result = await makeNotionRequest(accessToken, '/databases', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: parentPageId },
      title: [{ type: 'text', text: { content: 'Test Tasks' } }],
      properties: {
        'Task': { title: {} },
        'Status': {
          select: {
            options: [
              { name: 'To Do', color: 'gray' },
              { name: 'In Progress', color: 'blue' },
              { name: 'Done', color: 'green' },
            ],
          },
        },
        'Due Date': { date: {} },
        'Completed': { checkbox: {} },
        'Hours': { number: {} },
        'Project': {
          relation: {
            database_id: projectsDbId,
            single_property: {},
          },
        },
      },
    }),
  });

  console.log(`  Created Tasks database: ${result.id}`);
  return result.id;
}

async function addProjectRecords(accessToken: string, projectsDbId: string): Promise<string[]> {
  console.log('Adding project records...');

  const projects = [
    { name: 'Website Redesign', status: 'In Progress', priority: 'High', budget: 50000, startDate: '2024-01-15' },
    { name: 'Mobile App', status: 'Planning', priority: 'Medium', budget: 75000, startDate: '2024-03-01' },
    { name: 'API Integration', status: 'Completed', priority: 'High', budget: 25000, startDate: '2024-01-01' },
  ];

  const projectIds: string[] = [];

  for (const project of projects) {
    const result = await makeNotionRequest(accessToken, '/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: projectsDbId },
        properties: {
          'Name': { title: [{ text: { content: project.name } }] },
          'Status': { select: { name: project.status } },
          'Priority': { select: { name: project.priority } },
          'Budget': { number: project.budget },
          'Start Date': { date: { start: project.startDate } },
        },
      }),
    });
    projectIds.push(result.id);
    console.log(`  Added project: ${project.name}`);
  }

  return projectIds;
}

async function addTaskRecords(accessToken: string, tasksDbId: string, projectIds: string[]): Promise<void> {
  console.log('Adding task records...');

  const tasks = [
    { task: 'Design mockups', status: 'Done', dueDate: '2024-01-20', completed: true, hours: 16, projectIdx: 0 },
    { task: 'Implement homepage', status: 'In Progress', dueDate: '2024-02-01', completed: false, hours: 24, projectIdx: 0 },
    { task: 'Setup CI/CD', status: 'Done', dueDate: '2024-01-25', completed: true, hours: 8, projectIdx: 0 },
    { task: 'Create wireframes', status: 'To Do', dueDate: '2024-03-15', completed: false, hours: 12, projectIdx: 1 },
    { task: 'User research', status: 'In Progress', dueDate: '2024-03-10', completed: false, hours: 20, projectIdx: 1 },
    { task: 'Write API docs', status: 'Done', dueDate: '2024-01-10', completed: true, hours: 6, projectIdx: 2 },
    { task: 'Integration testing', status: 'Done', dueDate: '2024-01-12', completed: true, hours: 10, projectIdx: 2 },
  ];

  for (const task of tasks) {
    await makeNotionRequest(accessToken, '/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: tasksDbId },
        properties: {
          'Task': { title: [{ text: { content: task.task } }] },
          'Status': { select: { name: task.status } },
          'Due Date': { date: { start: task.dueDate } },
          'Completed': { checkbox: task.completed },
          'Hours': { number: task.hours },
          'Project': { relation: [{ id: projectIds[task.projectIdx] }] },
        },
      }),
    });
    console.log(`  Added task: ${task.task}`);
  }
}

async function main() {
  console.log('=== Creating Test Databases in Notion ===\n');

  // Get the most recent Notion connection
  const connection = await prisma.connectedAccount.findFirst({
    where: { platform: 'notion' },
    orderBy: { connectedAt: 'desc' },
  });

  if (!connection) {
    console.error('No Notion connection found. Please connect Notion first.');
    process.exit(1);
  }

  console.log(`Using Notion account: ${connection.platformAccountName}\n`);

  const accessToken = connection.accessToken;

  try {
    // Find a parent page
    const parentPageId = await findParentPage(accessToken);
    console.log(`Using parent page: ${parentPageId}\n`);

    // Create Projects database
    const projectsDbId = await createProjectsDatabase(accessToken, parentPageId);

    // Create Tasks database with relation to Projects
    const tasksDbId = await createTasksDatabase(accessToken, parentPageId, projectsDbId);

    console.log('');

    // Add sample data
    const projectIds = await addProjectRecords(accessToken, projectsDbId);
    await addTaskRecords(accessToken, tasksDbId, projectIds);

    console.log('\n=== Done! ===');
    console.log('\nCreated databases:');
    console.log(`  - Test Projects: ${projectsDbId}`);
    console.log(`  - Test Tasks: ${tasksDbId}`);
    console.log('\nThe Tasks database has a "Project" relation column pointing to Projects.');
    console.log('\nNow go to the app, refresh the schema, select both databases,');
    console.log('and export with "Relational SQLite" to test foreign keys!');

  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
