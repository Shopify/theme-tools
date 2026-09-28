import { describe, expect, it, vi } from 'vitest';
import { MissingBlockArguments } from './checks/missing-block-arguments';
import { UnrecognizedBlockArguments } from './checks/unrecognized-block-arguments';
import { ValidBlockArgumentTypes } from './checks/valid-block-argument-types';
import { check } from './index';
import { check as runChecks } from './test';
import { type Setting, type ThemeBlock, ThemeSchemaType, type ThemeBlockSchema } from './types';

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
