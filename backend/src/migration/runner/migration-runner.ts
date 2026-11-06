import { logger } from '../../common/logger.js';
import { NormalizedResult } from '../../transformers/interfaces.js';
import { IIdMapStore } from '../id-map.interfaces.js';
import { resolveRelations, ResolvedLink } from '../relation-resolver.js';
import { MigrationPlan, TablePlan } from '../plan/plan.types.js';
import { INotionWriter } from '../notion/notion-writer.interface.js';
import {
  NOTION_LIMITS,
  NotionPropertyValue,
  NotionSchemaConfig,
  relationValue,
  toSchemaConfig,
} from '../notion/notion-values.js';
import { MigrationReport } from './migration-report.js';
import { buildPageProperties } from './page-builder.js';
import { RunContext, RunOptions } from './run-context.js';

const key = (tableId: string, propertyName: string): string => `${tableId}\u0000${propertyName}`;

/**
 * Moves normalised records into Notion following a migration plan, in four steps:
 *   1. create one database per table (without relations),
 *   2. add relation properties once every target database exists,
 *   3. create a page per record,
 *   4. write links once every page exists.
 *
 * Every created object is recorded in the ID map before moving on, so re-running the
 * same run ID after an interruption skips finished work instead of duplicating it.
 *
 * An object with a mapping that never reached "created" may still have been saved: a server
 * error can follow a successful write, and a crash can land between the write and recording
 * it. Those objects are looked up in Notion before being created again. If the lookup itself
 * fails nothing is created, and the object waits for the next run.
 */
export class MigrationRunner {
  constructor(
    private readonly writer: INotionWriter,
    private readonly store: IIdMapStore
  ) {}

  async run(
    plan: MigrationPlan,
    results: NormalizedResult[],
    options: RunOptions
  ): Promise<MigrationReport> {
    const context = new RunContext(plan, results, options);
    logger.info(
      { runId: options.runId, tables: plan.tables.length, dryRun: options.dryRun },
      'Migration started'
    );

    for (const table of plan.tables) await this.createDatabase(context, table);
    for (const table of plan.tables) await this.addRelationProperties(context, table);
    for (const table of plan.tables) await this.createPages(context, table);
    await this.writeLinks(context, results);

    const report = context.finish();
    logger.info({ runId: options.runId, complete: report.complete }, 'Migration finished');
    return report;
  }

  private async createDatabase(context: RunContext, table: TablePlan): Promise<void> {
    const { runId, parentPageId } = context.options;
    const existing = this.store.getTargetId(runId, 'database', table.sourceDatabaseId);
    if (existing) {
      context.dataSources.set(table.sourceDatabaseId, existing);
      return;
    }

    const properties: Record<string, NotionSchemaConfig> = {
      [table.sourceIdPropertyName]: { type: 'rich_text', rich_text: {} },
    };
    for (const field of table.fields) {
      const config = field.targetType === 'relation' ? undefined : toSchemaConfig(field);
      if (config) properties[field.targetName] = config;
    }

    try {
      const attempted = this.store.get(runId, 'database', table.sourceDatabaseId) !== undefined;
      const earlier = attempted
        ? await this.writer.findDatabase(parentPageId, table.name, table.sourceIdPropertyName)
        : undefined;
      this.store.reserve(runId, 'database', table.sourceDatabaseId);
      const created =
        earlier ??
        (await this.writer.createDatabase({ parentPageId, title: table.name, properties }));
      this.store.markCreated(runId, 'database', table.sourceDatabaseId, created.dataSourceId);
      context.dataSources.set(table.sourceDatabaseId, created.dataSourceId);
      Object.assign(context.tableReport(table), {
        databaseId: created.databaseId,
        dataSourceId: created.dataSourceId,
        url: created.url,
      });
    } catch (error) {
      this.store.markFailed(runId, 'database', table.sourceDatabaseId, String(error));
      context.fail('database', table, table.sourceDatabaseId, error);
    }
  }

  private async addRelationProperties(context: RunContext, table: TablePlan): Promise<void> {
    const dataSourceId = context.dataSources.get(table.sourceDatabaseId);
    if (!dataSourceId) return;

    const properties: Record<string, NotionSchemaConfig> = {};
    for (const field of table.fields.filter((f) => f.targetType === 'relation')) {
      const target = context.dataSources.get(field.relationTargetDatabaseId ?? '');
      const config = toSchemaConfig(field, target);
      if (config) properties[field.targetName] = config;
    }
    if (Object.keys(properties).length === 0) return;

    try {
      // Re-sending the same relation properties on resume leaves them unchanged.
      await this.writer.addDataSourceProperties(dataSourceId, properties);
      Object.keys(properties).forEach((name) =>
        context.relationProperties.add(key(table.sourceDatabaseId, name))
      );
    } catch (error) {
      context.fail('schema', table, table.sourceDatabaseId, error);
    }
  }

  private async createPages(context: RunContext, table: TablePlan): Promise<void> {
    const report = context.tableReport(table);
    const records = context.recordsByTable.get(table.sourceDatabaseId) ?? [];
    const dataSourceId = context.dataSources.get(table.sourceDatabaseId);
    if (!dataSourceId) {
      report.records.failed = records.length;
      return;
    }

    for (const record of records) {
      context.report.filesNotCopied += record.attachments.length;
      await this.createPage(context, table, record, dataSourceId);
    }
  }

  private async createPage(
    context: RunContext,
    table: TablePlan,
    record: NormalizedResult,
    dataSourceId: string
  ): Promise<void> {
    const { runId } = context.options;
    const report = context.tableReport(table);
    const sourceId = record.entity.id;
    // Built for every record, so each run's report lists all values that could not move.
    const properties = buildPageProperties(context, table, record);
    if (this.store.getTargetId(runId, 'entity', sourceId)) {
      report.records.alreadyDone++;
      return;
    }

    try {
      if (await this.adoptEarlierPage(context, table, sourceId, dataSourceId)) {
        report.records.alreadyDone++;
        return;
      }
      this.store.reserve(runId, 'entity', sourceId);
      const { pageId } = await this.writer.createPage(dataSourceId, properties);
      this.store.markCreated(runId, 'entity', sourceId, pageId);
      report.records.created++;
    } catch (error) {
      this.store.markFailed(runId, 'entity', sourceId, String(error));
      report.records.failed++;
      context.fail('page', table, sourceId, error);
    }
  }

  /** Records a page saved by an earlier attempt of this record, if there is one. */
  private async adoptEarlierPage(
    context: RunContext,
    table: TablePlan,
    sourceId: string,
    dataSourceId: string
  ): Promise<boolean> {
    const { runId } = context.options;
    if (this.store.get(runId, 'entity', sourceId) === undefined) return false;
    const earlier = await this.writer.findPageBySourceId(
      dataSourceId,
      table.sourceIdPropertyName,
      sourceId
    );
    if (!earlier) return false;
    this.store.markCreated(runId, 'entity', sourceId, earlier.pageId);
    return true;
  }

  private async writeLinks(context: RunContext, results: NormalizedResult[]): Promise<void> {
    const relations = results
      .flatMap((r) => r.relations)
      .filter((r) => context.tableOfRecord.has(r.fromEntityId));
    const { resolved, unresolved } = resolveRelations(relations, this.store, context.options.runId);
    context.report.links.planned = resolved.length + unresolved.length;
    context.report.links.unresolved = unresolved.length;
    context.report.unresolvedLinks = unresolved;

    for (const [pageId, links] of this.groupByPage(resolved)) {
      const table = context.tableOfRecord.get(links[0].fromEntityId)!;
      const { properties, count } = this.relationProperties(context, table, links);
      if (count === 0) continue;
      try {
        await this.writer.updatePageProperties(pageId, properties);
        context.report.links.written += count;
      } catch (error) {
        context.fail('links', table, links[0].fromEntityId, error);
      }
    }
  }

  private groupByPage(links: ResolvedLink[]): Map<string, ResolvedLink[]> {
    const byPage = new Map<string, ResolvedLink[]>();
    for (const link of links) {
      byPage.set(link.fromTargetId, [...(byPage.get(link.fromTargetId) ?? []), link]);
    }
    return byPage;
  }

  /** One relation value per field on a page; Notion accepts at most 100 links per field per request. */
  private relationProperties(
    context: RunContext,
    table: TablePlan,
    links: ResolvedLink[]
  ): { properties: Record<string, NotionPropertyValue>; count: number } {
    const byField = new Map<string, string[]>();
    for (const link of links) {
      const field = context.field(table, link.propertyName ?? '');
      if (
        !field ||
        !context.relationProperties.has(key(table.sourceDatabaseId, field.targetName))
      ) {
        context.report.links.unresolved++;
        continue;
      }
      byField.set(field.targetName, [...(byField.get(field.targetName) ?? []), link.toTargetId]);
    }

    const properties: Record<string, NotionPropertyValue> = {};
    let count = 0;
    for (const [name, ids] of byField) {
      const kept = ids.slice(0, NOTION_LIMITS.relationsPerRequest);
      context.report.links.truncated += ids.length - kept.length;
      count += kept.length;
      properties[name] = relationValue(kept);
    }
    return { properties, count };
  }
}
