import type { IConnector } from './interfaces.js';
import { NotionConnector } from './notion/index.js';
import { AirtableConnector } from './airtable/index.js';
import { GoogleSheetsConnector } from './google-sheets/index.js';
import type { Platform } from '../common/types.js';

export type { IConnector } from './interfaces.js';
export { NotionConnector } from './notion/index.js';
export { AirtableConnector } from './airtable/index.js';
export { GoogleSheetsConnector } from './google-sheets/index.js';

const connectors: Record<Platform, new () => IConnector> = {
  notion: NotionConnector,
  airtable: AirtableConnector,
  google_sheets: GoogleSheetsConnector,
};

export class ConnectorFactory {
  static create(platform: Platform): IConnector {
    const ConnectorClass = connectors[platform];
    if (!ConnectorClass) {
      throw new Error(`Unknown platform: ${platform}`);
    }
    return new ConnectorClass();
  }

  static getAvailablePlatforms(): Platform[] {
    return Object.keys(connectors) as Platform[];
  }

  static isSupported(platform: string): platform is Platform {
    return platform in connectors;
  }
}
