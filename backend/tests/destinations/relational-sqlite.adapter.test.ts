import { sanitizeSQLIdentifier, convertToRelationalSchema } from '../../src/destinations/relational-sqlite.adapter';

describe('sanitizeSQLIdentifier', () => {
  it('should convert spaces to underscores', () => {
    expect(sanitizeSQLIdentifier('My Tasks')).toBe('my_tasks');
  });

  it('should convert to lowercase', () => {
    expect(sanitizeSQLIdentifier('MyTasks')).toBe('mytasks');
  });

  it('should remove special characters', () => {
    expect(sanitizeSQLIdentifier('Tasks (2024)')).toBe('tasks_2024');
  });

  it('should collapse multiple underscores', () => {
    expect(sanitizeSQLIdentifier('Tasks   List')).toBe('tasks_list');
  });

  it('should trim leading and trailing underscores', () => {
    expect(sanitizeSQLIdentifier(' Tasks ')).toBe('tasks');
  });

  it('should prefix with underscore if starts with number', () => {
    expect(sanitizeSQLIdentifier('2024 Tasks')).toBe('_2024_tasks');
  });

  it('should suffix reserved words with _col', () => {
    expect(sanitizeSQLIdentifier('select')).toBe('select_col');
    expect(sanitizeSQLIdentifier('table')).toBe('table_col');
    expect(sanitizeSQLIdentifier('from')).toBe('from_col');
  });

  it('should handle empty string', () => {
    expect(sanitizeSQLIdentifier('')).toBe('unnamed');
  });

  it('should handle string with only special characters', () => {
    expect(sanitizeSQLIdentifier('!!!')).toBe('unnamed');
  });
});

describe('convertToRelationalSchema', () => {
  it('should convert a database schema to relational format', () => {
    const result = convertToRelationalSchema(
      'db-123',
      'My Tasks',
      [
        { id: 'prop-1', name: 'Task Name', type: 'text' },
        { id: 'prop-2', name: 'Due Date', type: 'date' },
        { id: 'prop-3', name: 'Priority', type: 'select' },
      ]
    );

    expect(result).toEqual({
      id: 'db-123',
      name: 'My Tasks',
      tableName: 'my_tasks',
      properties: [
        { id: 'prop-1', name: 'Task Name', columnName: 'task_name', type: 'text' },
        { id: 'prop-2', name: 'Due Date', columnName: 'due_date', type: 'date' },
        { id: 'prop-3', name: 'Priority', columnName: 'priority', type: 'select' },
      ],
    });
  });

  it('should preserve relationTargetDatabaseId', () => {
    const result = convertToRelationalSchema(
      'db-123',
      'Tasks',
      [
        {
          id: 'prop-1',
          name: 'Project',
          type: 'relation',
          relationTargetDatabaseId: 'db-456',
        },
      ]
    );

    expect(result.properties[0].relationTargetDatabaseId).toBe('db-456');
  });

  it('should handle reserved words in property names', () => {
    const result = convertToRelationalSchema(
      'db-123',
      'Items',
      [
        { id: 'prop-1', name: 'Select', type: 'text' },
        { id: 'prop-2', name: 'Order', type: 'number' },
      ]
    );

    expect(result.properties[0].columnName).toBe('select_col');
    expect(result.properties[1].columnName).toBe('order_col');
  });
});
