import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../scripts/compare-test-results.ts');
const ALLOW_NEW = [
  '--allow-new',
  'packages/liquid-html-parser/src/backend.test.ts',
  '--allow-new',
  'packages/liquid-html-parser/src/rust-parity/**',
];
const TIMEOUT = 60_000;

interface Assertion {
  fullName: string;
  status: string;
}

interface FileResult {
  name: string;
  status: string;
  message: string;
  assertionResults: Assertion[];
}

let tmp: string;
let repo: string;

function file(relative: string, assertions: [string, string][]): FileResult {
  return {
    name: path.join(repo, relative),
    status: 'passed',
    message: '',
    assertionResults: assertions.map(([fullName, status]) => ({ fullName, status })),
  };
}

function importError(relative: string): FileResult {
  return {
    name: path.join(repo, relative),
    status: 'failed',
    message: 'boom on import',
    assertionResults: [],
  };
}

function writeReport(name: string, testResults: FileResult[]): string {
  const target = path.join(tmp, `${name}.json`);
  fs.writeFileSync(target, JSON.stringify({ testResults }));
  return target;
}

function compare(a: string, b: string, extra: string[] = []) {
  const result = spawnSync('pnpx', ['tsx', SCRIPT, a, b, ...extra], { encoding: 'utf-8' });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

function ruleCount(stdout: string, rule: number): number {
  const match = stdout.match(new RegExp(`^rule ${rule}, [^:]+: (\\d+)$`, 'm'));
  if (!match) throw new Error(`no rule ${rule} line in:\n${stdout}`);
  return Number(match[1]);
}

function ruleCounts(stdout: string): number[] {
  return [1, 2, 3, 4, 5].map((rule) => ruleCount(stdout, rule));
}

const astTest = 'packages/liquid-html-parser/src/ast.test.ts';
const prettierSpec = 'packages/prettier-plugin-liquid/src/x.spec.ts';
const baseFiles = () => [
  file(astTest, [
    ['a', 'passed'],
    ['b', 'skipped'],
  ]),
  file(prettierSpec, [['c', 'passed']]),
];

describe('compare-test-results', () => {
  let base: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'compare-test-results-'));
    repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo);
    fs.writeFileSync(path.join(repo, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    base = writeReport('base', baseFiles());
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it(
    'exits 0 when B equals A plus passing allowlisted tests',
    () => {
      const b = writeReport('clean', [
        ...baseFiles(),
        file('packages/liquid-html-parser/src/backend.test.ts', [['n1', 'passed']]),
        file('packages/liquid-html-parser/src/rust-parity/differential.test.ts', [
          ['n2', 'passed'],
        ]),
      ]);
      const { code, stdout } = compare(base, b, ALLOW_NEW);
      expect(code).toBe(0);
      expect(ruleCounts(stdout)).toEqual([0, 0, 0, 0, 0]);
      expect(stdout).toContain('A: 3 tests, B: 5 tests, 2 new tests');
    },
    TIMEOUT,
  );

  it(
    'rule 1: fails when a baseline test is missing from B',
    () => {
      const b = writeReport('rule1', [
        file(astTest, [['b', 'skipped']]),
        file(prettierSpec, [['c', 'passed']]),
      ]);
      const { code, stdout } = compare(base, b, ALLOW_NEW);
      expect(code).toBe(1);
      expect(ruleCounts(stdout)).toEqual([1, 0, 0, 0, 0]);
    },
    TIMEOUT,
  );

  it(
    'rule 2: fails when a shared test flips from skipped to passed',
    () => {
      const b = writeReport('rule2', [
        file(astTest, [
          ['a', 'passed'],
          ['b', 'passed'],
        ]),
        file(prettierSpec, [['c', 'passed']]),
      ]);
      const { code, stdout } = compare(base, b, ALLOW_NEW);
      expect(code).toBe(1);
      expect(ruleCounts(stdout)).toEqual([0, 1, 0, 0, 0]);
    },
    TIMEOUT,
  );

  it(
    'rule 3: fails when a new test sits outside the allowlist',
    () => {
      const b = writeReport('rule3', [
        ...baseFiles(),
        file('packages/liquid-html-parser/src/other.test.ts', [['n3', 'passed']]),
      ]);
      const { code, stdout } = compare(base, b, ALLOW_NEW);
      expect(code).toBe(1);
      expect(ruleCounts(stdout)).toEqual([0, 0, 1, 0, 0]);
    },
    TIMEOUT,
  );

  it(
    'rule 4: fails when a new allowlisted test did not pass',
    () => {
      const b = writeReport('rule4', [
        ...baseFiles(),
        file('packages/liquid-html-parser/src/backend.test.ts', [['n4', 'failed']]),
      ]);
      const { code, stdout } = compare(base, b, ALLOW_NEW);
      expect(code).toBe(1);
      expect(ruleCounts(stdout)).toEqual([0, 0, 0, 1, 0]);
    },
    TIMEOUT,
  );

  it(
    'rule 5: fails with --allow-new when an allowlisted file fails on import with zero assertions',
    () => {
      const b = writeReport('rule5', [
        ...baseFiles(),
        importError('packages/liquid-html-parser/src/rust-parity/differential.test.ts'),
      ]);
      const { code, stdout } = compare(base, b, ALLOW_NEW);
      expect(code).toBe(1);
      expect(ruleCounts(stdout)).toEqual([0, 0, 0, 0, 1]);
      expect(stdout).toContain(
        'packages/liquid-html-parser/src/rust-parity/differential.test.ts: failed, 0 assertions',
      );
    },
    TIMEOUT,
  );

  it(
    'rule 5: fails without --allow-new when a file fails on import with zero assertions',
    () => {
      const b = writeReport('rule5-no-flag', [
        ...baseFiles(),
        importError('packages/liquid-html-parser/src/rust-parity/differential.test.ts'),
      ]);
      const { code, stdout } = compare(base, b);
      expect(code).toBe(1);
      expect(stdout).toContain('0 differences');
      expect(ruleCount(stdout, 5)).toBe(1);
    },
    TIMEOUT,
  );

  it(
    'without --allow-new, fails on an added test',
    () => {
      const b = writeReport('no-flag', [
        ...baseFiles(),
        file('packages/liquid-html-parser/src/backend.test.ts', [['n1', 'passed']]),
      ]);
      const { code, stdout } = compare(base, b);
      expect(code).toBe(1);
      expect(stdout).toContain('A: 3 tests, B: 4 tests, 1 differences');
      expect(ruleCount(stdout, 5)).toBe(0);
    },
    TIMEOUT,
  );

  it(
    'exits 2 with a usage error on a dangling --allow-new',
    () => {
      const { code, stderr } = compare(base, base, ['--allow-new']);
      expect(code).toBe(2);
      expect(stderr).toContain('Usage:');
    },
    TIMEOUT,
  );

  it(
    'keeps keys stable when B gains a file outside the common directory of A',
    () => {
      const documentTest = 'packages/liquid-html-parser/src/document/tokenizer.test.ts';
      const a = writeReport('narrow-a', [
        file(documentTest, [
          ['t1', 'passed'],
          ['t2', 'passed'],
        ]),
      ]);
      const b = writeReport('narrow-b', [
        file(documentTest, [
          ['t1', 'passed'],
          ['t2', 'passed'],
        ]),
        file('packages/liquid-html-parser/src/rust-parity/differential.test.ts', [
          ['d1', 'passed'],
        ]),
      ]);
      const { code, stdout } = compare(a, b, ALLOW_NEW);
      expect(code).toBe(0);
      expect(ruleCounts(stdout)).toEqual([0, 0, 0, 0, 0]);
      expect(stdout).toContain('A: 2 tests, B: 3 tests, 1 new tests');
      expect(stdout).toContain(
        '  packages/liquid-html-parser/src/rust-parity/differential.test.ts > d1: passed',
      );
    },
    TIMEOUT,
  );
});
