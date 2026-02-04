import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  IDestinationAdapter,
  DestinationConfig,
  WriteResult,
  AdapterCapabilities,
  Transaction,
} from './interfaces.js';
import {
  NormalizedEntity,
  NormalizedProperty,
  NormalizedRelation,
  NormalizedContentBlock,
  NormalizedAttachment,
} from '../transformers/interfaces.js';
import { logger } from '../common/logger.js';

export interface MarkdownConfig {
  type: 'markdown';
  outputDir: string;
  includeMetadata?: boolean;
  includeFrontmatter?: boolean;
}

interface MarkdownData {
  entities: NormalizedEntity[];
  properties: Map<string, NormalizedProperty[]>;
  contentBlocks: Map<string, NormalizedContentBlock[]>;
  attachments: Map<string, NormalizedAttachment[]>;
}

export class MarkdownAdapter implements IDestinationAdapter {
  private config: MarkdownConfig | null = null;
  private data: MarkdownData | null = null;
  private inTransaction = false;

  async connect(config: DestinationConfig): Promise<void> {
    if (config.type !== 'markdown') {
      throw new Error('Invalid config type for MarkdownAdapter');
    }

    this.config = config as MarkdownConfig;
    await mkdir(this.config.outputDir, { recursive: true });

    logger.info({ outputDir: this.config.outputDir }, 'Markdown adapter initialized');
  }

  async disconnect(): Promise<void> {
    this.config = null;
    this.data = null;
    logger.info('Markdown adapter disconnected');
  }

  async testConnection(): Promise<boolean> {
    return this.config !== null;
  }

  async createSchema(): Promise<void> {
    this.data = {
      entities: [],
      properties: new Map(),
      contentBlocks: new Map(),
      attachments: new Map(),
    };
    logger.info('Markdown export structure initialized');
  }

  async getExistingSchema(): Promise<boolean> {
    return false;
  }

  async beginTransaction(): Promise<Transaction> {
    const transaction: Transaction = {
      id: uuidv4(),
      startedAt: new Date(),
    };

    this.inTransaction = true;
    return transaction;
  }

  async commit(_transaction: Transaction): Promise<void> {
    if (!this.config || !this.data) {
      throw new Error('Adapter not connected');
    }

    // Write each entity as a markdown file
    for (const entity of this.data.entities) {
      const markdown = this.entityToMarkdown(entity);
      const filename = this.sanitizeFilename(entity.title || entity.id) + '.md';
      const filepath = join(this.config.outputDir, filename);
      await writeFile(filepath, markdown, 'utf-8');
    }

    // Write index file
    const indexContent = this.createIndexFile();
    await writeFile(join(this.config.outputDir, '_index.md'), indexContent, 'utf-8');

    this.inTransaction = false;
    logger.info({ outputDir: this.config.outputDir, entityCount: this.data.entities.length }, 'Markdown export committed');
  }

  async rollback(_transaction: Transaction): Promise<void> {
    if (this.data) {
      this.data = {
        entities: [],
        properties: new Map(),
        contentBlocks: new Map(),
        attachments: new Map(),
      };
    }
    this.inTransaction = false;
    logger.info('Markdown export rolled back');
  }

  async writeEntities(entities: NormalizedEntity[]): Promise<WriteResult> {
    if (!this.data) throw new Error('Adapter not connected');

    this.data.entities.push(...entities);
    return { inserted: entities.length, updated: 0, failed: 0 };
  }

  async writeProperties(properties: NormalizedProperty[]): Promise<WriteResult> {
    if (!this.data) throw new Error('Adapter not connected');

    for (const prop of properties) {
      const existing = this.data.properties.get(prop.entityId) || [];
      existing.push(prop);
      this.data.properties.set(prop.entityId, existing);
    }
    return { inserted: properties.length, updated: 0, failed: 0 };
  }

  async writeRelations(_relations: NormalizedRelation[]): Promise<WriteResult> {
    // Relations are not directly written in markdown - they're referenced in content
    return { inserted: 0, updated: 0, failed: 0 };
  }

  async writeContentBlocks(blocks: NormalizedContentBlock[]): Promise<WriteResult> {
    if (!this.data) throw new Error('Adapter not connected');

    for (const block of blocks) {
      const existing = this.data.contentBlocks.get(block.entityId) || [];
      existing.push(block);
      this.data.contentBlocks.set(block.entityId, existing);
    }
    return { inserted: blocks.length, updated: 0, failed: 0 };
  }

  async writeAttachments(attachments: NormalizedAttachment[]): Promise<WriteResult> {
    if (!this.data) throw new Error('Adapter not connected');

    for (const att of attachments) {
      const existing = this.data.attachments.get(att.entityId) || [];
      existing.push(att);
      this.data.attachments.set(att.entityId, existing);
    }
    return { inserted: attachments.length, updated: 0, failed: 0 };
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsTransactions: true,
      supportsRelations: false,
      supportsBulkInsert: true,
      maxBatchSize: 1000,
      supportsJSONFields: false,
      supportsFullTextSearch: false,
    };
  }

  estimateSize(recordCount: number): number {
    // Rough estimate: 3KB per record for Markdown
    return recordCount * 3072;
  }

  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }

  private entityToMarkdown(entity: NormalizedEntity): string {
    const lines: string[] = [];

    // YAML frontmatter
    if (this.config?.includeFrontmatter !== false) {
      lines.push('---');
      lines.push(`id: ${entity.id}`);
      lines.push(`type: ${entity.entityType}`);
      if (entity.createdAt) {
        lines.push(`created: ${entity.createdAt.toISOString()}`);
      }
      if (entity.updatedAt) {
        lines.push(`updated: ${entity.updatedAt.toISOString()}`);
      }
      lines.push(`source: ${entity.sourcePlatform}`);
      if (entity.sourceUrl) {
        lines.push(`url: ${entity.sourceUrl}`);
      }
      lines.push('---');
      lines.push('');
    }

    // Title
    lines.push(`# ${entity.title || 'Untitled'}`);
    lines.push('');

    // Properties as table
    const properties = this.data?.properties.get(entity.id) || [];
    if (properties.length > 0) {
      lines.push('## Properties');
      lines.push('');
      lines.push('| Property | Value |');
      lines.push('|----------|-------|');
      for (const prop of properties) {
        const value = this.getPropertyValue(prop);
        lines.push(`| ${prop.propertyName} | ${value} |`);
      }
      lines.push('');
    }

    // Content blocks
    const blocks = this.data?.contentBlocks.get(entity.id) || [];
    if (blocks.length > 0) {
      // Sort blocks by position
      const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position);

      for (const block of sortedBlocks) {
        const content = this.blockToMarkdown(block);
        if (content) {
          lines.push(content);
        }
      }
    }

    // Attachments
    const attachments = this.data?.attachments.get(entity.id) || [];
    if (attachments.length > 0) {
      lines.push('');
      lines.push('## Attachments');
      lines.push('');
      for (const att of attachments) {
        const link = att.localPath || att.sourceUrl || att.fileName;
        lines.push(`- [${att.fileName}](${link})`);
      }
    }

    return lines.join('\n');
  }

  private getPropertyValue(prop: NormalizedProperty): string {
    if (prop.valueText !== null && prop.valueText !== undefined) {
      return prop.valueText;
    }
    if (prop.valueNumber !== null && prop.valueNumber !== undefined) {
      return prop.valueNumber.toString();
    }
    if (prop.valueDate !== null && prop.valueDate !== undefined) {
      return prop.valueDate.toISOString().split('T')[0];
    }
    if (prop.valueBoolean !== null && prop.valueBoolean !== undefined) {
      return prop.valueBoolean ? 'Yes' : 'No';
    }
    if (prop.valueJson !== null && prop.valueJson !== undefined) {
      return JSON.stringify(prop.valueJson);
    }
    return '';
  }

  private blockToMarkdown(block: NormalizedContentBlock): string {
    const content = block.content || '';
    const blockType = block.blockType as string; // Allow any string for flexibility

    switch (blockType) {
      case 'paragraph':
        return content + '\n';
      case 'heading_1':
        return `## ${content}\n`;
      case 'heading_2':
        return `### ${content}\n`;
      case 'heading_3':
        return `#### ${content}\n`;
      case 'bulleted_list':
      case 'bulleted_list_item':
        return `- ${content}`;
      case 'numbered_list':
      case 'numbered_list_item':
        return `1. ${content}`;
      case 'to_do':
        const checked = block.metadata?.checked ? 'x' : ' ';
        return `- [${checked}] ${content}`;
      case 'toggle':
        return `<details>\n<summary>${content}</summary>\n</details>\n`;
      case 'code':
        const language = block.metadata?.language || '';
        return `\`\`\`${language}\n${content}\n\`\`\`\n`;
      case 'quote':
        return `> ${content}\n`;
      case 'divider':
        return '---\n';
      case 'callout':
        const emoji = block.metadata?.icon || '💡';
        return `> ${emoji} ${content}\n`;
      case 'image':
        const url = block.metadata?.url || content;
        const caption = block.metadata?.caption || '';
        return `![${caption}](${url})\n`;
      case 'video':
      case 'embed':
      case 'file':
        const embedUrl = block.metadata?.url || content;
        return `[Embedded content](${embedUrl})\n`;
      case 'table':
      case 'table_row':
        return this.renderTable(block);
      default:
        return content ? content + '\n' : '';
    }
  }

  private renderTable(block: NormalizedContentBlock): string {
    const rows = block.metadata?.rows as string[][] | undefined;
    if (!rows || rows.length === 0) return '';

    const lines: string[] = [];

    // Header row
    lines.push('| ' + rows[0].join(' | ') + ' |');
    // Separator
    lines.push('| ' + rows[0].map(() => '---').join(' | ') + ' |');
    // Data rows
    for (let i = 1; i < rows.length; i++) {
      lines.push('| ' + rows[i].join(' | ') + ' |');
    }

    return lines.join('\n') + '\n';
  }

  private createIndexFile(): string {
    const lines: string[] = [];

    lines.push('# Export Index');
    lines.push('');
    lines.push(`Exported at: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('## Contents');
    lines.push('');

    if (this.data) {
      for (const entity of this.data.entities) {
        const filename = this.sanitizeFilename(entity.title || entity.id) + '.md';
        lines.push(`- [${entity.title || 'Untitled'}](./${filename})`);
      }
    }

    return lines.join('\n');
  }

  getOutputPath(): string {
    if (!this.config) throw new Error('Adapter not connected');
    return this.config.outputDir;
  }
}
