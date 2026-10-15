/**
 * Compare two vitest JSON reports by full test name and status.
 *
 * Usage: pnpx tsx scripts/compare-test-results.ts A.json B.json [--allow-new <glob>]...
 *
 * A test is keyed by its file, relative to its report's repo root, plus its
 * full name. Each report's repo root is found separately, by walking up from
 * its first test file to the directory holding pnpm-workspace.yaml.
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
 *
 * Rule 5 applies with or without --allow-new. Exits 1 if any test file in B
 * failed at the file level: status `failed`, or a collection or import error
 * with zero assertions.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const USAGE = "Usage: pnpx tsx scripts/compare-test-results.ts A.json B.json [--allow-new <glob>]...";

interface AssertionResult {
  fullName: string;
  status: string;
}

interface FileResult {
  name: string;
  status?: string;
  message?: string;
  assertionResults: AssertionResult[];
}

interface Report {
  testResults: FileResult[];
}

interface LoadedReport {
  tests: Map<string, TestEntry>;
  fileFailures: string[];
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

function findRepoRoot(file: string): string | undefined {
  let dir = path.dirname(file);
  while (!fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return dir;
}

function failedAtFileLevel(result: FileResult): boolean {
  if (result.status === "failed") return true;
  return result.assertionResults.length === 0 && Boolean(result.message);
}

function describeFileFailure(result: FileResult, root: string): string {
  const message = (result.message ?? "").split("\n")[0];
  return `${path.relative(root, result.name)}: ${result.status}, ${result.assertionResults.length} assertions, ${message}`;
}

function loadReport(file: string): LoadedReport {
  const report: Report = JSON.parse(fs.readFileSync(file, "utf-8"));
  const tests = new Map<string, TestEntry>();
  if (report.testResults.length === 0) return { tests, fileFailures: [] };

  const root = findRepoRoot(report.testResults[0].name);
  if (!root) throw new Error(`${file}: no pnpm-workspace.yaml above ${report.testResults[0].name}`);

  for (const result of report.testResults) {
    const repoFile = path.relative(root, result.name);
    for (const assertion of result.assertionResults) {
      const baseKey = `${repoFile} > ${assertion.fullName}`;
      let key = baseKey;
      for (let n = 2; tests.has(key); n++) key = `${baseKey} #${n}`;
      tests.set(key, { status: assertion.status, repoFile });
    }
  }
  const fileFailures = report.testResults
    .filter(failedAtFileLevel)
    .map((result) => describeFileFailure(result, root));
  return { tests, fileFailures };
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

function printFileFailures(fileFailures: string[]): void {
  console.log(`rule 5, test files failed at file level: ${fileFailures.length}`);
  for (const line of fileFailures) console.log(`  ${line}`);
}

function runStrict(a: Map<string, TestEntry>, b: LoadedReport): number {
  const differences = compareStrict(a, b.tests);
  console.log(`A: ${a.size} tests, B: ${b.tests.size} tests, ${differences.length} differences`);
  for (const line of differences) console.log(`  ${line}`);
  printFileFailures(b.fileFailures);
  return differences.length === 0 && b.fileFailures.length === 0 ? 0 : 1;
}

function runWithAllowlist(a: Map<string, TestEntry>, b: LoadedReport, allowNew: string[]): number {
  const rules = compareWithAllowlist(a, b.tests, allowNew);
  const newTests = [...b.tests.keys()].filter((key) => !a.has(key));
  console.log(`A: ${a.size} tests, B: ${b.tests.size} tests, ${newTests.length} new tests`);
  console.log(`allow-new: ${allowNew.join(", ")}`);
  rules.forEach((rule, i) => {
    console.log(`rule ${i + 1}, ${rule.title}: ${rule.lines.length}`);
    for (const line of rule.lines) console.log(`  ${line}`);
  });
  printFileFailures(b.fileFailures);
  console.log("new tests:");
  for (const key of newTests.sort()) console.log(`  ${key}: ${b.tests.get(key)!.status} (${b.tests.get(key)!.repoFile})`);
  const rulesClean = rules.every((rule) => rule.lines.length === 0);
  return rulesClean && b.fileFailures.length === 0 ? 0 : 1;
}

function loadBoth(args: Args): [LoadedReport, LoadedReport] | undefined {
  try {
    return [loadReport(args.fileA), loadReport(args.fileB)];
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(USAGE);
    process.exit(2);
  }
  const reports = loadBoth(args);
  if (!reports) process.exit(2);
  const [a, b] = reports;
  const code = args.allowNew.length === 0 ? runStrict(a.tests, b) : runWithAllowlist(a.tests, b, args.allowNew);
  process.exit(code);
}

main();
