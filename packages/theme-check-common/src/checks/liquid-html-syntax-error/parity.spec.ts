import { describe, it, afterAll, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { runLiquidCheck } from '../../test';
import { LiquidHTMLSyntaxError } from './index';

interface Scenario {
  id: string;
  template: string;
  error_path: string;
  file_path?: string;
}

interface SnapshotEntry {
  id: string;
  error: string | null;
  type: string | null;
}

const Outcome = {
  MATCH: 'MATCH',
  UNEXPECTED_MISS: 'UNEXPECTED_MISS',
  FALSE_POSITIVE: 'FALSE_POSITIVE',
  AGREE_NO_ERROR: 'AGREE_NO_ERROR',
} as const;

type Outcome = (typeof Outcome)[keyof typeof Outcome];

interface RecordEntry {
  tag: string;
  scenarioId: string;
  outcome: Outcome;
  message?: string;
}

class ParityReport {
  private entries: RecordEntry[] = [];

  record(outcome: Outcome, details: { tag: string; scenarioId: string; message?: string }) {
    this.entries.push({ ...details, outcome });
  }

  print() {
    const counts: Record<Outcome, number> = {
      [Outcome.MATCH]: 0,
      [Outcome.UNEXPECTED_MISS]: 0,
      [Outcome.FALSE_POSITIVE]: 0,
      [Outcome.AGREE_NO_ERROR]: 0,
    };

    for (const entry of this.entries) {
      counts[entry.outcome]++;
    }

    const total = this.entries.length;
    const detected = counts[Outcome.MATCH];
    const coverage = total > 0 ? ((detected / total) * 100).toFixed(1) : '0.0';

    console.log('');
    console.log('=== Liquid Syntax Error Parity Report ===');
    console.log('');
    console.log(`Total scenarios: ${total}`);
    console.log(`  MATCH (both detect): ${String(counts[Outcome.MATCH]).padStart(3)}`);
    console.log(`  UNEXPECTED MISS:     ${String(counts[Outcome.UNEXPECTED_MISS]).padStart(3)}`);
    console.log(`  FALSE POSITIVE:      ${String(counts[Outcome.FALSE_POSITIVE]).padStart(3)}`);
    console.log(`  AGREE NO ERROR:      ${String(counts[Outcome.AGREE_NO_ERROR]).padStart(3)}`);
    console.log('');
    console.log(`Coverage: ${coverage}% (${detected}/${total} detected)`);

    printEntries('Unexpected misses', this.entries, Outcome.UNEXPECTED_MISS);
    printEntries('False positives', this.entries, Outcome.FALSE_POSITIVE);
    console.log('');
  }
}

function printEntries(title: string, entries: RecordEntry[], outcome: Outcome) {
  const matchingEntries = entries.filter((entry) => entry.outcome === outcome);
  if (matchingEntries.length === 0) return;

  console.log('');
  console.log(`${title}:`);
  for (const entry of matchingEntries) {
    const suffix = entry.message ? `: ${entry.message}` : '';
    console.log(`  - ${entry.scenarioId}${suffix}`);
  }
}

const scenariosDir = resolve(__dirname, 'parity', 'scenarios');
const report = new ParityReport();

function loadScenarios(tag: string): Scenario[] {
  return parse(readFileSync(resolve(scenariosDir, `${tag}.yml`), 'utf8')) as Scenario[];
}

function loadSnapshots(tag: string): SnapshotEntry[] {
  return parse(
    readFileSync(resolve(__dirname, 'parity', 'snapshots', `${tag}.snap.yml`), 'utf8'),
  ) as SnapshotEntry[];
}

async function runParityScenario(tag: string, scenario: Scenario, snapshots: SnapshotEntry[]) {
  const snap = snapshots.find((entry) => entry.id === scenario.id);
  expect(snap, `No snapshot for ${scenario.id}`).toBeDefined();

  const fileName = scenario.file_path?.replace(/^\/+/, '') ?? 'templates/template.liquid';
  const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, scenario.template, fileName);
  const rubyDetected = Boolean(snap?.error);
  const themeCheckDetected = offenses.length > 0;

  if (rubyDetected && themeCheckDetected) {
    report.record(Outcome.MATCH, { tag, scenarioId: scenario.id });
    return;
  }

  if (rubyDetected && !themeCheckDetected) {
    report.record(Outcome.UNEXPECTED_MISS, {
      tag,
      scenarioId: scenario.id,
      message: snap?.error ?? undefined,
    });
    expect.fail(
      `UNEXPECTED_MISS [${scenario.id}]: Ruby Liquid detects an error but theme-check does not`,
    );
  }

  if (!rubyDetected && themeCheckDetected) {
    report.record(Outcome.FALSE_POSITIVE, {
      tag,
      scenarioId: scenario.id,
      message: offenses[0].message,
    });
    expect.fail(
      `FALSE_POSITIVE [${scenario.id}]: theme-check reports an error but Ruby Liquid does not`,
    );
  }

  report.record(Outcome.AGREE_NO_ERROR, { tag, scenarioId: scenario.id });
}

for (const tag of readdirSync(scenariosDir)
  .filter((file) => file.endsWith('.yml'))
  .map((file) => file.replace('.yml', ''))) {
  const scenarios = loadScenarios(tag);
  if (scenarios.length === 0) continue;

  const snapshots = loadSnapshots(tag);

  describe(`Ruby Liquid parity: ${tag}`, () => {
    it.each(scenarios)('$id', async (scenario) => {
      await runParityScenario(tag, scenario, snapshots);
    });
  });
}

afterAll(() => {
  if (process.env.PARITY_REPORT === '1') {
    report.print();
  }
});
