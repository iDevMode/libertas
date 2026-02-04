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
  blocks?: NotionBlock[];
}

interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  paragraph?: { rich_text: Array<{ plain_text: string }> };
  heading_1?: { rich_text: Array<{ plain_text: string }> };
  heading_2?: { rich_text: Array<{ plain_text: string }> };
  heading_3?: { rich_text: Array<{ plain_text: string }> };
  bulleted_list_item?: { rich_text: Array<{ plain_text: string }> };
  numbered_list_item?: { rich_text: Array<{ plain_text: string }> };
  to_do?: { rich_text: Array<{ plain_text: string }>; checked: boolean };
  toggle?: { rich_text: Array<{ plain_text: string }> };
  code?: { rich_text: Array<{ plain_text: string }>; language: string };
  quote?: { rich_text: Array<{ plain_text: string }> };
  callout?: { rich_text: Array<{ plain_text: string }>; icon?: { type: string; emoji?: string } };
  divider?: Record<string, never>;
  image?: { type: string; external?: { url: string }; file?: { url: string } };
  video?: { type: string; external?: { url: string }; file?: { url: string } };
  embed?: { url: string };
  bookmark?: { url: string };
  table_of_contents?: Record<string, never>;
  child_page?: { title: string };
  child_database?: { title: string };
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
      if (prop.type === 'relation' && Array.isArray(prop.relation)) {
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

  normalizeContentBlocks(raw: RawEntity): NormalizedContentBlock[] {
    const page = raw.rawData as NotionPage;
    const blocks: NormalizedContentBlock[] = [];

    if (!page.blocks || !Array.isArray(page.blocks)) {
      return [];
    }

    for (let i = 0; i < page.blocks.length; i++) {
      const block = page.blocks[i];
      const normalized = this.normalizeBlock(page.id, block, i);
      if (normalized) {
        blocks.push(normalized);
      }
    }

    return blocks;
  }

  private normalizeBlock(
    entityId: string,
    block: NotionBlock,
    position: number
  ): NormalizedContentBlock | null {
    const base = {
      id: block.id,
      entityId,
      position,
    };

    switch (block.type) {
      case 'paragraph':
        return {
          ...base,
          blockType: 'paragraph',
          content: this.extractPlainText(block.paragraph?.rich_text),
          metadata: { rich_text: block.paragraph?.rich_text },
        };

      case 'heading_1':
        return {
          ...base,
          blockType: 'heading_1',
          content: this.extractPlainText(block.heading_1?.rich_text),
          metadata: { rich_text: block.heading_1?.rich_text },
        };

      case 'heading_2':
        return {
          ...base,
          blockType: 'heading_2',
          content: this.extractPlainText(block.heading_2?.rich_text),
          metadata: { rich_text: block.heading_2?.rich_text },
        };

      case 'heading_3':
        return {
          ...base,
          blockType: 'heading_3',
          content: this.extractPlainText(block.heading_3?.rich_text),
          metadata: { rich_text: block.heading_3?.rich_text },
        };

      case 'bulleted_list_item':
        return {
          ...base,
          blockType: 'bulleted_list_item',
          content: this.extractPlainText(block.bulleted_list_item?.rich_text),
          metadata: { rich_text: block.bulleted_list_item?.rich_text },
        };

      case 'numbered_list_item':
        return {
          ...base,
          blockType: 'numbered_list_item',
          content: this.extractPlainText(block.numbered_list_item?.rich_text),
          metadata: { rich_text: block.numbered_list_item?.rich_text },
        };

      case 'to_do':
        return {
          ...base,
          blockType: 'to_do',
          content: this.extractPlainText(block.to_do?.rich_text),
          metadata: {
            checked: block.to_do?.checked,
            rich_text: block.to_do?.rich_text,
          },
        };

      case 'toggle':
        return {
          ...base,
          blockType: 'toggle',
          content: this.extractPlainText(block.toggle?.rich_text),
          metadata: { rich_text: block.toggle?.rich_text },
        };

      case 'code':
        return {
          ...base,
          blockType: 'code',
          content: this.extractPlainText(block.code?.rich_text),
          metadata: {
            language: block.code?.language,
            rich_text: block.code?.rich_text,
          },
        };

      case 'quote':
        return {
          ...base,
          blockType: 'quote',
          content: this.extractPlainText(block.quote?.rich_text),
          metadata: { rich_text: block.quote?.rich_text },
        };

      case 'callout':
        return {
          ...base,
          blockType: 'callout',
          content: this.extractPlainText(block.callout?.rich_text),
          metadata: {
            icon: block.callout?.icon,
            rich_text: block.callout?.rich_text,
          },
        };

      case 'divider':
        return {
          ...base,
          blockType: 'divider',
          content: null,
        };

      case 'image':
        return {
          ...base,
          blockType: 'image',
          content: block.image?.external?.url || block.image?.file?.url || null,
          metadata: { image: block.image },
        };

      case 'video':
        return {
          ...base,
          blockType: 'video',
          content: block.video?.external?.url || block.video?.file?.url || null,
          metadata: { video: block.video },
        };

      case 'embed':
        return {
          ...base,
          blockType: 'embed',
          content: block.embed?.url || null,
          metadata: { embed: block.embed },
        };

      case 'bookmark':
        return {
          ...base,
          blockType: 'bookmark',
          content: block.bookmark?.url || null,
          metadata: { bookmark: block.bookmark },
        };

      case 'table_of_contents':
        return {
          ...base,
          blockType: 'table_of_contents',
          content: null,
        };

      case 'child_page':
        return {
          ...base,
          blockType: 'child_page',
          content: block.child_page?.title || null,
        };

      case 'child_database':
        return {
          ...base,
          blockType: 'child_database',
          content: block.child_database?.title || null,
        };

      default:
        // For unsupported block types, store raw data
        return {
          ...base,
          blockType: block.type,
          content: null,
          metadata: { raw: block },
        };
    }
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

  private extractPlainText(richText: Array<{ plain_text: string }> | undefined | null): string {
    if (!richText || !Array.isArray(richText)) {
      return '';
    }
    return richText.map((t) => t.plain_text).join('');
  }

  private extractParentId(parent: NotionPage['parent']): string | undefined {
    if (parent.type === 'page_id') return parent.page_id;
    if (parent.type === 'database_id') return parent.database_id;
    return undefined;
  }
}
