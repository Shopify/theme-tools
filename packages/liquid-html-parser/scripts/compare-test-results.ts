/**
 * Compare two vitest JSON reports by full test name and status.
 *
 * Usage: pnpx tsx scripts/compare-test-results.ts A.json B.json
 *
 * A test is keyed by its file, relative to the common directory of all test
 * files in its report, plus its full name. Exits 1 if any test is missing from
 * one side or has a different status, and prints each difference.
 */
import * as fs from "node:fs";
import * as path from "node:path";

interface AssertionResult {
  fullName: string;
  status: string;
}

interface Report {
  testResults: { name: string; assertionResults: AssertionResult[] }[];
}

function commonDir(files: string[]): string {
  if (files.length === 0) return "";
  const split = files.map((file) => path.dirname(file).split(path.sep));
  const first = split[0];
  let length = first.length;
  for (const parts of split) {
    let i = 0;
    while (i < length && parts[i] === first[i]) i++;
    length = i;
  }
  return first.slice(0, length).join(path.sep);
}

function loadStatuses(file: string): Map<string, string> {
  const report: Report = JSON.parse(fs.readFileSync(file, "utf-8"));
  const root = commonDir(report.testResults.map((result) => result.name));
  const statuses = new Map<string, string>();
  for (const result of report.testResults) {
    const testFile = path.relative(root, result.name);
    for (const assertion of result.assertionResults) {
      const baseKey = `${testFile} > ${assertion.fullName}`;
      let key = baseKey;
      for (let n = 2; statuses.has(key); n++) key = `${baseKey} #${n}`;
      statuses.set(key, assertion.status);
    }
  }
  return statuses;
}

function compare(a: Map<string, string>, b: Map<string, string>): string[] {
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
  return keys
    .filter((key) => a.get(key) !== b.get(key))
    .map((key) => `${key}: ${a.get(key) ?? "<missing>"} -> ${b.get(key) ?? "<missing>"}`);
}

function main(): void {
  const [fileA, fileB] = process.argv.slice(2);
  if (!fileA || !fileB) {
    console.error("Usage: pnpx tsx scripts/compare-test-results.ts A.json B.json");
    process.exit(2);
  }
  const a = loadStatuses(fileA);
  const b = loadStatuses(fileB);
  const differences = compare(a, b);
  console.log(`A: ${a.size} tests, B: ${b.size} tests, ${differences.length} differences`);
  for (const line of differences) console.log(`  ${line}`);
  process.exit(differences.length === 0 ? 0 : 1);
}

main();
