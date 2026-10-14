/**
 * Compare two vitest JSON reports by full test name and status.
 *
 * Usage: pnpx tsx scripts/compare-test-results.ts A.json B.json [--allow-new <glob>]...
 *
 * A test is keyed by its file, relative to the common directory of all test
 * files in its report, plus its full name.
 *
 * Without --allow-new, exits 1 if any test is missing from one side or has a
 * different status, and prints each difference.
 *
 * With --allow-new, A is the baseline and B may add tests. Each glob is matched
 * against the test file path relative to the repo root. Exits 1 if any of:
 * 1. a baseline test is missing from B;
 * 2. a test in both has a different status, `skipped` to `passed` included;
 * 3. a new test sits in a file that matches no --allow-new glob;
 * 4. a new test does not have status `passed`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

const USAGE = "Usage: pnpx tsx scripts/compare-test-results.ts A.json B.json [--allow-new <glob>]...";

interface AssertionResult {
  fullName: string;
  status: string;
}

interface Report {
  testResults: { name: string; assertionResults: AssertionResult[] }[];
}

interface TestEntry {
  status: string;
  repoFile: string;
}

interface Args {
  fileA: string;
  fileB: string;
  allowNew: string[];
}

interface RuleResult {
  title: string;
  lines: string[];
}

function parseArgs(argv: string[]): Args | undefined {
  const positional: string[] = [];
  const allowNew: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--allow-new") {
      positional.push(argv[i]);
      continue;
    }
    const glob = argv[++i];
    if (!glob) return undefined;
    allowNew.push(glob);
  }
  if (positional.length !== 2) return undefined;
  return { fileA: positional[0], fileB: positional[1], allowNew };
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

function loadTests(file: string): Map<string, TestEntry> {
  const report: Report = JSON.parse(fs.readFileSync(file, "utf-8"));
  const root = commonDir(report.testResults.map((result) => result.name));
  const tests = new Map<string, TestEntry>();
  for (const result of report.testResults) {
    const testFile = path.relative(root, result.name);
    const repoFile = path.relative(REPO_ROOT, result.name);
    for (const assertion of result.assertionResults) {
      const baseKey = `${testFile} > ${assertion.fullName}`;
      let key = baseKey;
      for (let n = 2; tests.has(key); n++) key = `${baseKey} #${n}`;
      tests.set(key, { status: assertion.status, repoFile });
    }
  }
  return tests;
}

function compareStrict(a: Map<string, TestEntry>, b: Map<string, TestEntry>): string[] {
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
  return keys
    .filter((key) => a.get(key)?.status !== b.get(key)?.status)
    .map((key) => `${key}: ${a.get(key)?.status ?? "<missing>"} -> ${b.get(key)?.status ?? "<missing>"}`);
}

function matchesAny(file: string, globs: string[]): boolean {
  return globs.some((glob) => path.matchesGlob(file, glob));
}

function compareWithAllowlist(
  a: Map<string, TestEntry>,
  b: Map<string, TestEntry>,
  allowNew: string[],
): RuleResult[] {
  const baseKeys = [...a.keys()].sort();
  const newKeys = [...b.keys()].filter((key) => !a.has(key)).sort();
  const describeNew = (key: string) => `${key}: <missing> -> ${b.get(key)!.status} (${b.get(key)!.repoFile})`;

  const missing = baseKeys.filter((key) => !b.has(key));
  const changed = baseKeys.filter((key) => b.has(key) && a.get(key)!.status !== b.get(key)!.status);
  const outside = newKeys.filter((key) => !matchesAny(b.get(key)!.repoFile, allowNew));
  const notPassed = newKeys.filter((key) => b.get(key)!.status !== "passed");

  return [
    { title: "baseline tests missing from B", lines: missing.map((key) => `${key}: ${a.get(key)!.status} -> <missing>`) },
    { title: "shared tests with a different status", lines: changed.map((key) => `${key}: ${a.get(key)!.status} -> ${b.get(key)!.status}`) },
    { title: "new tests outside --allow-new", lines: outside.map(describeNew) },
    { title: "new tests not passed", lines: notPassed.map(describeNew) },
  ];
}

function runStrict(a: Map<string, TestEntry>, b: Map<string, TestEntry>): number {
  const differences = compareStrict(a, b);
  console.log(`A: ${a.size} tests, B: ${b.size} tests, ${differences.length} differences`);
  for (const line of differences) console.log(`  ${line}`);
  return differences.length === 0 ? 0 : 1;
}

function runWithAllowlist(a: Map<string, TestEntry>, b: Map<string, TestEntry>, allowNew: string[]): number {
  const rules = compareWithAllowlist(a, b, allowNew);
  const newTests = [...b.keys()].filter((key) => !a.has(key));
  console.log(`A: ${a.size} tests, B: ${b.size} tests, ${newTests.length} new tests`);
  console.log(`allow-new: ${allowNew.join(", ")}`);
  rules.forEach((rule, i) => {
    console.log(`rule ${i + 1}, ${rule.title}: ${rule.lines.length}`);
    for (const line of rule.lines) console.log(`  ${line}`);
  });
  console.log("new tests:");
  for (const key of newTests.sort()) console.log(`  ${key}: ${b.get(key)!.status} (${b.get(key)!.repoFile})`);
  return rules.every((rule) => rule.lines.length === 0) ? 0 : 1;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(USAGE);
    process.exit(2);
  }
  const a = loadTests(args.fileA);
  const b = loadTests(args.fileB);
  const code = args.allowNew.length === 0 ? runStrict(a, b) : runWithAllowlist(a, b, args.allowNew);
  process.exit(code);
}

main();
