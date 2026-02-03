import { RawEntity } from '../interfaces.js';
import {
  NormalizedEntity,
  NormalizedProperty,
  NormalizedRelation,
  NormalizedContentBlock,
  INormalizer,
} from '../../transformers/interfaces.js';
import { v4 as uuidv4 } from 'uuid';

interface NotionPage {
  id: string;
  object: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  icon?: { type: string; emoji?: string; external?: { url: string } };
  cover?: { type: string; external?: { url: string } };
  parent: { type: string; page_id?: string; database_id?: string; workspace?: boolean };
  properties: Record<string, NotionProperty>;
  url: string;
}

interface NotionProperty {
  id: string;
  type: string;
  title?: Array<{ plain_text: string }>;
  rich_text?: Array<{ plain_text: string }>;
  number?: number;
  select?: { id: string; name: string; color: string };
  multi_select?: Array<{ id: string; name: string; color: string }>;
  date?: { start: string; end?: string };
  checkbox?: boolean;
  url?: string;
  email?: string;
  phone_number?: string;
  relation?: Array<{ id: string }>;
  files?: Array<{ name: string; type: string; file?: { url: string }; external?: { url: string } }>;
}

export class NotionNormalizer implements INormalizer {
  normalizeEntity(raw: RawEntity): NormalizedEntity {
    const page = raw.rawData as NotionPage;

    return {
      id: page.id,
      entityType: page.object === 'database' ? 'database' : 'page',
      title: this.extractTitle(page.properties),
      createdAt: new Date(page.created_time),
      updatedAt: new Date(page.last_edited_time),
      parentId: this.extractParentId(page.parent),
      sourcePlatform: 'notion',
      sourceUrl: page.url,
      metadata: {
        archived: page.archived,
        icon: page.icon,
        cover: page.cover,
      },
    };
  }

  normalizeProperties(raw: RawEntity): NormalizedProperty[] {
    const page = raw.rawData as NotionPage;
    const properties: NormalizedProperty[] = [];
    let position = 0;

    for (const [name, prop] of Object.entries(page.properties)) {
      const normalized = this.normalizeProperty(raw.id, name, prop, position);
      if (normalized) {
        properties.push(normalized);
        position++;
      }
    }

    return properties;
  }

  normalizeRelations(raw: RawEntity): NormalizedRelation[] {
    const page = raw.rawData as NotionPage;
    const relations: NormalizedRelation[] = [];

    // Add parent relation
    const parentId = this.extractParentId(page.parent);
    if (parentId) {
      relations.push({
        id: uuidv4(),
        fromEntityId: page.id,
        toEntityId: parentId,
        relationType: 'child_of',
      });
    }

    // Add relation properties
    for (const [name, prop] of Object.entries(page.properties)) {
      if (prop.type === 'relation' && prop.relation) {
        for (const rel of prop.relation) {
          relations.push({
            id: uuidv4(),
            fromEntityId: page.id,
            toEntityId: rel.id,
            relationType: 'related_to',
            metadata: { propertyName: name },
          });
        }
      }
    }

    return relations;
  }

  normalizeContentBlocks(_raw: RawEntity): NormalizedContentBlock[] {
    // Content blocks require separate API calls to fetch
    // This will be implemented when fetching page content
    return [];
  }

  private normalizeProperty(
    entityId: string,
    name: string,
    prop: NotionProperty,
    position: number
  ): NormalizedProperty | null {
    const base = {
      id: uuidv4(),
      entityId,
      propertyName: name,
      position,
    };

    switch (prop.type) {
      case 'title':
      case 'rich_text':
        return {
          ...base,
          propertyType: 'text',
          valueText: this.extractPlainText(prop.title || prop.rich_text || []),
          valueJson: prop.title || prop.rich_text,
        };

      case 'number':
        return {
          ...base,
          propertyType: 'number',
          valueNumber: prop.number ?? undefined,
        };

      case 'select':
        return {
          ...base,
          propertyType: 'select',
          valueText: prop.select?.name,
          valueJson: prop.select,
        };

      case 'multi_select':
        return {
          ...base,
          propertyType: 'multi_select',
          valueJson: prop.multi_select,
        };

      case 'date':
        return {
          ...base,
          propertyType: 'date',
          valueDate: prop.date?.start ? new Date(prop.date.start) : undefined,
          valueJson: prop.date,
        };

      case 'checkbox':
        return {
          ...base,
          propertyType: 'boolean',
          valueBoolean: prop.checkbox,
        };

      case 'url':
        return {
          ...base,
          propertyType: 'url',
          valueText: prop.url ?? undefined,
        };

      case 'email':
        return {
          ...base,
          propertyType: 'email',
          valueText: prop.email ?? undefined,
        };

      case 'phone_number':
        return {
          ...base,
          propertyType: 'phone',
          valueText: prop.phone_number ?? undefined,
        };

      case 'files':
        return {
          ...base,
          propertyType: 'file',
          valueJson: prop.files,
        };

      case 'relation':
        // Relations are handled separately
        return null;

      default:
        return {
          ...base,
          propertyType: 'text',
          valueJson: prop,
        };
    }
  }

  private extractTitle(properties: Record<string, NotionProperty>): string {
    for (const prop of Object.values(properties)) {
      if (prop.type === 'title' && prop.title) {
        return this.extractPlainText(prop.title);
      }
    }
    return 'Untitled';
  }

  private extractPlainText(richText: Array<{ plain_text: string }>): string {
    return richText.map((t) => t.plain_text).join('');
  }

  private extractParentId(parent: NotionPage['parent']): string | undefined {
    if (parent.type === 'page_id') return parent.page_id;
    if (parent.type === 'database_id') return parent.database_id;
    return undefined;
  }
}
