export const Outcome = {
  MATCH: 'MATCH',
  EXPECTED_MISS: 'EXPECTED_MISS',
  UNEXPECTED_MISS: 'UNEXPECTED_MISS',
  FALSE_POSITIVE: 'FALSE_POSITIVE',
  AGREE_NO_ERROR: 'AGREE_NO_ERROR',
} as const;
export type Outcome = (typeof Outcome)[keyof typeof Outcome];

export interface RecordEntry {
  tag: string;
  scenarioId: string;
  outcome: Outcome;
  message?: string;
}

export class ParityReport {
  private entries: RecordEntry[] = [];

  record(outcome: Outcome, details: { tag: string; scenarioId: string; message?: string }): void {
    this.entries.push({
      tag: details.tag,
      scenarioId: details.scenarioId,
      outcome,
      message: details.message,
    });
  }

  print(): void {
    const counts: Record<Outcome, number> = {
      [Outcome.MATCH]: 0,
      [Outcome.EXPECTED_MISS]: 0,
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
    console.log('=== Syntax Error Parity Report ===');
    console.log('');
    console.log(`Total scenarios: ${total}`);
    console.log(`  MATCH (both detect):     ${String(counts[Outcome.MATCH]).padStart(3)}`);
    console.log(`  EXPECTED MISS (known):   ${String(counts[Outcome.EXPECTED_MISS]).padStart(3)}`);
    console.log(
      `  UNEXPECTED MISS:         ${String(counts[Outcome.UNEXPECTED_MISS]).padStart(3)}`,
    );
    console.log(`  FALSE POSITIVE:          ${String(counts[Outcome.FALSE_POSITIVE]).padStart(3)}`);
    console.log(`  AGREE NO ERROR:          ${String(counts[Outcome.AGREE_NO_ERROR]).padStart(3)}`);
    console.log('');
    console.log(`Coverage: ${coverage}% (${detected}/${total} detected)`);

    const unexpectedMisses = this.entries.filter((e) => e.outcome === Outcome.UNEXPECTED_MISS);
    if (unexpectedMisses.length > 0) {
      console.log('');
      console.log('Unexpected misses (need investigation):');
      for (const entry of unexpectedMisses) {
        const suffix = entry.message ? `: ${entry.message}` : '';
        console.log(`  - ${entry.scenarioId}${suffix}`);
      }
    }

    const falsePositives = this.entries.filter((e) => e.outcome === Outcome.FALSE_POSITIVE);
    if (falsePositives.length > 0) {
      console.log('');
      console.log('False positives (theme-check wrong):');
      for (const entry of falsePositives) {
        const suffix = entry.message ? `: ${entry.message}` : '';
        console.log(`  - ${entry.scenarioId}${suffix}`);
      }
    }

    console.log('');
  }
}
