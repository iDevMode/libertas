const Database = require('better-sqlite3');
const db = new Database('C:/Users/phils/Downloads/export-notion-ed657557-e76b-445e-9735-d27f7b5b8b50.db');

console.log('=== TABLE SCHEMAS ===\n');

// Show test_projects schema
const projSchema = db.prepare("SELECT sql FROM sqlite_master WHERE name='test_projects'").get();
console.log('test_projects:');
console.log(projSchema.sql);

// Show test_tasks schema
const taskSchema = db.prepare("SELECT sql FROM sqlite_master WHERE name='test_tasks'").get();
console.log('\ntest_tasks:');
console.log(taskSchema.sql);

console.log('\n=== SAMPLE DATA ===\n');

console.log('Projects:');
const projects = db.prepare('SELECT id, title, status, priority, budget FROM test_projects').all();
projects.forEach(p => console.log('  -', p.title, '|', p.status, '|', p.priority, '| $' + p.budget));

console.log('\nTasks:');
const tasks = db.prepare('SELECT id, title, status, completed, hours, project FROM test_tasks').all();
tasks.forEach(t => console.log('  -', t.title, '|', t.status, '| done:', t.completed, '|', t.hours, 'hrs | project:', t.project ? t.project.substring(0,8)+'...' : 'null'));

console.log('\n=== JOIN QUERY TEST ===\n');
const joined = db.prepare(`
  SELECT t.title as task, p.title as project, t.status, t.hours
  FROM test_tasks t
  LEFT JOIN test_projects p ON t.project = p.id
`).all();
console.log('Tasks with Project names (using JOIN):');
joined.forEach(r => console.log('  -', r.task, ' --> ', r.project, '|', r.status, '|', r.hours, 'hrs'));

db.close();
