import { describe, expect, it, vi } from 'vitest';
import { MissingBlockArguments } from './checks/missing-block-arguments';
import { UnrecognizedBlockArguments } from './checks/unrecognized-block-arguments';
import { ValidBlockArgumentTypes } from './checks/valid-block-argument-types';
import { check } from './index';
import { getTheme, MockFileSystem, check as runChecks } from './test';
import {
  type LiquidCheckDefinition,
  type Setting,
  Severity,
  SourceCodeType,
  type ThemeBlock,
  ThemeSchemaType,
  type ThemeBlockSchema,
} from './types';

describe('Module: Hello World', () => {
  it('should validate that we can test files', () => {
    expect(check).to.exist;
  });
});

describe('check', () => {
  it('shares block parameters within a run and reloads them on the next run', async () => {
    let settings = [
      setting({ id: 'title', type: 'text' }),
      setting({ id: 'count', type: 'number' }),
    ];
    const getBlockSchema = vi.fn(async () => blockSchema(settings));
    const getDocDefinition = vi.fn(async () => ({
      uri: 'file:/blocks/card.liquid',
      liquidDoc: { parameters: [] },
    }));
    const dependencies = { getBlockSchema, getDocDefinition };
    const source = [
      "{% block 'card', count: 'many', unknown: true %}{% endblock %}",
      "{% block 'card', count: 'many', unknown: true %}{% endblock %}",
    ].join('\n');
    const theme = { 'templates/index.liquid': source };
    const checks = [MissingBlockArguments, UnrecognizedBlockArguments, ValidBlockArgumentTypes];

    const firstRun = await runChecks(theme, checks, dependencies);

    expect(firstRun.map((offense) => offense.check).sort()).toEqual(
      [
        'UnrecognizedBlockArguments',
        'UnrecognizedBlockArguments',
        'ValidBlockArgumentTypes',
        'ValidBlockArgumentTypes',
      ].sort(),
    );
    expect(getBlockSchema).toHaveBeenCalledTimes(1);
    expect(getDocDefinition).toHaveBeenCalledTimes(1);

    settings = [
      setting({ id: 'count', type: 'text' }),
      setting({ id: 'unknown', type: 'checkbox' }),
    ];

    const secondRun = await runChecks(theme, checks, dependencies);

    expect(secondRun).toEqual([]);
    expect(getBlockSchema).toHaveBeenCalledTimes(2);
    expect(getDocDefinition).toHaveBeenCalledTimes(2);
  });
});

describe('check on Liquid files', () => {
  const files = {
    'snippets/a.liquid': '<p>{% if x %}{{ x }}{% endif %}</p>',
    'snippets/b.liquid': "{% render 'a' %}{% render 'a' %}",
  };

  function run(checks: LiquidCheckDefinition[], onError?: (error: Error) => void) {
    const config = { context: 'theme' as const, settings: {}, checks, rootUri: 'file:/', onError };
    return check(getTheme(files), config, { fs: new MockFileSystem(files) });
  }

  // Logs each method it runs, which takes a moment when `wait` is set.
  function logger(code: string, log: string[], wait = false) {
    return liquidCheck(code, ({ file }) => {
      const step = async (method: string) => {
        log.push(`${file.uri} ${code} ${method} start`);
        if (wait) await new Promise((resolve) => setTimeout(resolve, 1));
        log.push(`${file.uri} ${code} ${method} end`);
      };
      return {
        onCodePathStart: () => step('onCodePathStart'),
        LiquidTag: (node) => step(node.name),
        'LiquidTag:exit': (node) => step(`${node.name}:exit`),
        HtmlElement: () => step('HtmlElement'),
        onCodePathEnd: () => step('onCodePathEnd'),
      };
    });
  }

  const eventsOf = (log: string[], uri: string, code: string) =>
    log.filter((event) => event.startsWith(`${uri} ${code} `));

  it("runs each check's methods in the order it runs them alone, each settled before the next", async () => {
    const [fast, slow, together]: string[][] = [[], [], []];
    await run([logger('Fast', fast)]);
    await run([logger('Slow', slow, true)]);
    await run([logger('Fast', together), logger('Slow', together, true)]);

    for (const uri of ['file:///snippets/a.liquid', 'file:///snippets/b.liquid']) {
      expect(eventsOf(together, uri, 'Fast')).toEqual(eventsOf(fast, uri, 'Fast'));
      expect(eventsOf(together, uri, 'Slow')).toEqual(eventsOf(slow, uri, 'Slow'));
    }
    expect(eventsOf(slow, 'file:///snippets/b.liquid', 'Slow')).toHaveLength(12);
  });

  it('stops a check that throws on that file only, and reports its error once', async () => {
    const calls: string[] = [];
    const errors: Error[] = [];
    const throws = liquidCheck('Throws', ({ file }) => ({
      async LiquidTag() {
        calls.push(file.uri);
        throw new Error(`Throws failed on ${file.uri}`);
      },
      async onCodePathEnd() {
        calls.push(`${file.uri} end`);
      },
    }));
    const empty = liquidCheck('Empty', () => undefined as any);
    const reports = liquidCheck('Reports', (context) => ({
      async LiquidTag(node) {
        context.report({ message: node.name, startIndex: node.position.start, endIndex: 0 });
      },
    }));

    const offenses = await run([throws, empty, reports], (error) => errors.push(error));

    expect(calls).toEqual(['file:///snippets/a.liquid', 'file:///snippets/b.liquid']);
    expect(errors.map((error) => error.message).sort()).toEqual([
      expect.stringContaining('Cannot read'),
      expect.stringContaining('Cannot read'),
      'Throws failed on file:///snippets/a.liquid',
      'Throws failed on file:///snippets/b.liquid',
    ]);
    expect(offenses.map((offense) => offense.message).sort()).toEqual(['if', 'render', 'render']);
  });
});

function liquidCheck(code: string, create: LiquidCheckDefinition['create']): LiquidCheckDefinition {
  return {
    meta: {
      code,
      name: code,
      docs: { description: code },
      type: SourceCodeType.LiquidHtml,
      severity: Severity.ERROR,
      schema: {},
      targets: [],
    },
    create,
  };
}

function setting(value: Record<string, unknown>): Setting.InputSetting {
  return value as unknown as Setting.InputSetting;
}

function blockSchema(settings: Setting.InputSetting[]): ThemeBlockSchema {
  const schema: ThemeBlock.Schema = { settings };
  return {
    type: ThemeSchemaType.Block,
    name: 'card',
    ast: new Error('Unused in block parameter integration tests'),
    parsed: {},
    validSchema: schema,
    offset: 1,
    value: '{}',
    staticBlockDefs: [],
  };
}
