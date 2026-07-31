import { describe, it, afterAll, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { lintLiquid } from './lint-liquid';
import { type Scenario, loadScenarios, loadSnapshots } from './loader';
import { normalizeSnapshot, normalizeThemeCheck } from './normalize';
import { Outcome, ParityReport } from './report';

const report = new ParityReport();

const scenariosDir = resolve(__dirname, 'scenarios');
const tags = readdirSync(scenariosDir)
  .filter((f) => f.endsWith('.yml'))
  .map((f) => f.replace('.yml', ''));

/*
 * Scenarios where Ruby Liquid reports an error that LiquidSyntaxError does
 * not. Each entry is asserted to STILL miss, so the day the gap closes this
 * suite fails and the entry gets deleted rather than quietly masking a
 * re-introduced regression.
 *
 *   section-themecheck-bare-bracket-arg — `{% section 'header', foo: [0] %}`.
 *     The section syntax check skips BlockArrayLiteral argument values,
 *     which @shopify/liquid-html-parser produces for `[0]`, so the bare
 *     bracket never reaches the bare-array-access test. Ruby rejects named
 *     arguments on {% section %} outright.
 */
const KNOWN_GAPS = new Set(['section-themecheck-bare-bracket-arg']);

async function runParityScenario(
  tag: string,
  scenario: Scenario,
  snapshots: ReturnType<typeof loadSnapshots>,
) {
  const snap = snapshots.find((s) => s.id === scenario.id);
  expect(snap, `No snapshot for ${scenario.id}`).toBeDefined();

  const diagnostics = await lintLiquid(scenario.template, scenario.file_path);
  const snapshotNorm = normalizeSnapshot(snap!);
  const themeCheckNorm = normalizeThemeCheck(diagnostics);

  if (KNOWN_GAPS.has(scenario.id)) {
    expect(
      themeCheckNorm.detected,
      `[${scenario.id}] is listed in KNOWN_GAPS but theme-check now reports it — remove the entry`,
    ).toBe(false);
    return;
  }

  if (snapshotNorm.detected && themeCheckNorm.detected) {
    report.record(Outcome.MATCH, { tag, scenarioId: scenario.id });
    return;
  }

  if (snapshotNorm.detected && !themeCheckNorm.detected) {
    report.record(Outcome.UNEXPECTED_MISS, {
      tag,
      scenarioId: scenario.id,
      message: snapshotNorm.coreMessage,
    });
    expect.fail(
      `UNEXPECTED_MISS [${scenario.id}]: snapshot detects error but theme-check does not`,
    );
    return;
  }

  if (!snapshotNorm.detected && themeCheckNorm.detected) {
    report.record(Outcome.FALSE_POSITIVE, {
      tag,
      scenarioId: scenario.id,
      message: themeCheckNorm.coreMessage,
    });
    expect.fail(`FALSE_POSITIVE [${scenario.id}]: theme-check reports error but snapshot has none`);
    return;
  }

  report.record(Outcome.AGREE_NO_ERROR, { tag, scenarioId: scenario.id });
}

for (const tag of tags) {
  const scenarios = loadScenarios(tag);
  const snapshots = loadSnapshots(tag);

  describe(`Parity: ${tag}`, () => {
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
