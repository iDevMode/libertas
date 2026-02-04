import { IDestinationAdapter, DestinationConfig } from './interfaces.js';
import { SQLiteAdapter } from './sqlite.adapter.js';
import { JSONAdapter } from './json.adapter.js';
import { CSVAdapter } from './csv.adapter.js';
import { MarkdownAdapter } from './markdown.adapter.js';

export * from './interfaces.js';
export { SQLiteAdapter } from './sqlite.adapter.js';
export { JSONAdapter } from './json.adapter.js';
export { CSVAdapter } from './csv.adapter.js';
export { MarkdownAdapter } from './markdown.adapter.js';

export class DestinationFactory {
  static create(type: string): IDestinationAdapter {
    switch (type) {
      case 'sqlite':
        return new SQLiteAdapter();
      case 'json':
        return new JSONAdapter();
      case 'csv':
        return new CSVAdapter();
      case 'markdown':
        return new MarkdownAdapter();
      case 'postgresql':
        throw new Error('PostgreSQL adapter not yet implemented (Pro feature)');
      default:
        throw new Error(`Unknown destination type: ${type}`);
    }
  }

  static getSupportedTypes(): string[] {
    return ['sqlite', 'json', 'csv', 'markdown']; // MVP supported types
  }
}
