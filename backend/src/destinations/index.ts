import { IDestinationAdapter, DestinationConfig } from './interfaces.js';
import { SQLiteAdapter } from './sqlite.adapter.js';

export * from './interfaces.js';
export { SQLiteAdapter } from './sqlite.adapter.js';

export class DestinationFactory {
  static create(config: DestinationConfig): IDestinationAdapter {
    switch (config.type) {
      case 'sqlite':
        return new SQLiteAdapter();
      case 'postgresql':
        throw new Error('PostgreSQL adapter not yet implemented (Pro feature)');
      case 'json':
        throw new Error('JSON exporter not yet implemented');
      case 'csv':
        throw new Error('CSV exporter not yet implemented');
      default:
        throw new Error(`Unknown destination type: ${(config as DestinationConfig).type}`);
    }
  }

  static getSupportedTypes(): string[] {
    return ['sqlite', 'json', 'csv']; // MVP supported types
  }
}
