import { NormalizedResult } from '../../transformers/interfaces.js';
import { MemoryIdMapStore } from '../memory-id-map.store.js';
import { DryRunNotionWriter } from '../notion/dry-run.writer.js';
import { MigrationPlan } from '../plan/plan.types.js';
import { MigrationReport } from './migration-report.js';
import { MigrationRunner } from './migration-runner.js';

/**
 * Runs the full migration logic against a stand-in for Notion: nothing is written anywhere,
 * and the report shows exactly what a real run would create, skip and lose.
 */
export async function dryRunMigration(
  plan: MigrationPlan,
  results: NormalizedResult[],
  runId = 'dry-run'
): Promise<MigrationReport> {
  const writer = new DryRunNotionWriter();
  const store = new MemoryIdMapStore();
  try {
    const report = await new MigrationRunner(writer, store).run(plan, results, {
      runId,
      parentPageId: 'dry-run-parent',
      dryRun: true,
    });
    report.plannedRequests = writer.requests.length;
    return report;
  } finally {
    store.close();
  }
}
