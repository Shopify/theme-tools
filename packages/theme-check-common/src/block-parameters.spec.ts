import { describe, expect, it, vi } from 'vitest';
import { makeGetBlockParameters, resolveBlockParameters } from './block-parameters';
import type { LiquidDocParameter } from './liquid-doc/liquidDoc';
import { type Setting, type ThemeBlock, ThemeSchemaType, type ThemeBlockSchema } from './types';

const schema = (settings: Setting.InputSetting[]): ThemeBlock.Schema => ({ settings });
const setting = (value: Record<string, unknown>): Setting.InputSetting =>
  value as unknown as Setting.InputSetting;
const docs = (...parameters: LiquidDocParameter[]) => ({
  uri: 'file:/blocks/card.liquid',
  liquidDoc: { parameters },
});

const blockSchema = (settings: Setting.InputSetting[]): ThemeBlockSchema => ({
  type: ThemeSchemaType.Block,
  name: 'card',
  ast: new Error('Unused in block parameter tests'),
  parsed: {},
  validSchema: schema(settings),
  offset: 1,
  value: '{}',
  staticBlockDefs: [],
});

describe('makeGetBlockParameters', () => {
  it('loads a block name once', async () => {
    const getBlockSchema = vi
      .fn()
      .mockResolvedValue(blockSchema([setting({ id: 'title', type: 'text' })]));
    const getDocDefinition = vi
      .fn()
      .mockResolvedValue(docs(liquidDoc('tracking_id', 'String', false)));
    const getBlockParameters = makeGetBlockParameters({ getBlockSchema, getDocDefinition });

    const [first, second] = await Promise.all([
      getBlockParameters('card'),
      getBlockParameters('card'),
    ]);

    expect(second).toBe(first);
    expect(getBlockSchema).toHaveBeenCalledTimes(1);
    expect(getDocDefinition).toHaveBeenCalledTimes(1);
  });

  it('loads distinct block names separately', async () => {
    const getBlockSchema = vi.fn(async (name: string) =>
      blockSchema([setting({ id: name, type: 'text' })]),
    );
    const getDocDefinition = vi.fn().mockResolvedValue(docs());
    const getBlockParameters = makeGetBlockParameters({ getBlockSchema, getDocDefinition });

    const [card, constructor] = await Promise.all([
      getBlockParameters('card'),
      getBlockParameters('constructor'),
    ]);

    expect([...card!.keys()]).toEqual(['content', 'card']);
    expect([...constructor!.keys()]).toEqual(['content', 'constructor']);
    expect(getBlockSchema).toHaveBeenCalledTimes(2);
    expect(getDocDefinition).toHaveBeenCalledTimes(2);
  });

  it('does not share results across resolvers with the same providers', async () => {
    const getBlockSchema = vi
      .fn()
      .mockResolvedValue(blockSchema([setting({ id: 'title', type: 'text' })]));
    const getDocDefinition = vi.fn().mockResolvedValue(docs());
    const providers = { getBlockSchema, getDocDefinition };
    const firstResolver = makeGetBlockParameters(providers);
    const secondResolver = makeGetBlockParameters(providers);

    const [first, second] = await Promise.all([firstResolver('card'), secondResolver('card')]);

    expect(second).not.toBe(first);
    expect(getBlockSchema).toHaveBeenCalledTimes(2);
    expect(getDocDefinition).toHaveBeenCalledTimes(2);
  });

  it('returns undefined without both providers', async () => {
    const getBlockSchema = vi.fn().mockResolvedValue(blockSchema([]));
    const getDocDefinition = vi.fn().mockResolvedValue(docs());
    const withoutBlockSchema = makeGetBlockParameters({ getDocDefinition });
    const withoutDocDefinition = makeGetBlockParameters({ getBlockSchema });

    await expect(withoutBlockSchema('card')).resolves.toBeUndefined();
    await expect(withoutDocDefinition('card')).resolves.toBeUndefined();
    expect(getBlockSchema).not.toHaveBeenCalled();
    expect(getDocDefinition).not.toHaveBeenCalled();
  });
});

describe('resolveBlockParameters', () => {
  it('merges schema types with LiquidDoc requiredness', () => {
    const parameters = resolveBlockParameters(
      schema([setting({ id: 'title', type: 'text' }), setting({ id: 'product', type: 'product' })]),
      docs(
        liquidDoc('title', 'String', false),
        liquidDoc('product', 'object', true),
        liquidDoc('tracking_id', 'String', true),
      ),
    );

    expect([...parameters.values()]).toEqual([
      { name: 'content', type: 'string', required: false },
      {
        name: 'title',
        type: 'string',
        required: false,
        schemaSetting: expect.objectContaining({ id: 'title' }),
        liquidDoc: expect.objectContaining({ name: 'title' }),
      },
      {
        name: 'product',
        type: 'product',
        required: true,
        schemaSetting: expect.objectContaining({ id: 'product' }),
        liquidDoc: expect.objectContaining({ name: 'product' }),
      },
      {
        name: 'tracking_id',
        type: 'string',
        required: true,
        liquidDoc: expect.objectContaining({ name: 'tracking_id' }),
      },
    ]);
  });

  it.each([
    ['an implicit platform default', { id: 'value', type: 'checkbox' }],
    [
      'a required explicit default',
      { id: 'value', type: 'range', min: 0, max: 10, step: 1, default: 5 },
    ],
    ['a type that does not permit a default', { id: 'value', type: 'image_picker' }],
  ])('treats a schema setting with %s as optional', (_name, value) => {
    const parameters = resolveBlockParameters(schema([setting(value)]));

    expect(parameters.get('value')).toMatchObject({ required: false });
  });

  it('keeps schema-backed content typed as string with LiquidDoc requiredness', () => {
    const parameters = resolveBlockParameters(
      schema([setting({ id: 'content', type: 'number' })]),
      docs(liquidDoc('content', 'Number', true)),
    );

    expect(parameters.get('content')).toMatchObject({
      type: 'string',
      required: true,
      schemaSetting: { id: 'content', type: 'number' },
      liquidDoc: { name: 'content' },
    });
  });

  it('keeps built-in content typed as string with LiquidDoc requiredness', () => {
    const parameters = resolveBlockParameters(
      schema([]),
      docs(liquidDoc('content', 'Number', true)),
    );

    expect(parameters.get('content')).toMatchObject({ type: 'string', required: true });
    expect(parameters.get('content')?.schemaSetting).toBeUndefined();
  });

  it('normalizes LiquidDoc-only types and ignores malformed ones', () => {
    const parameters = resolveBlockParameters(
      undefined,
      docs(
        liquidDoc('products', 'Product[]', true),
        liquidDoc('untyped', null, false),
        liquidDoc('malformed', 'not a type', false),
      ),
    );

    expect(parameters.get('products')).toMatchObject({ type: 'product[]' });
    expect(parameters.get('untyped')?.type).toBeUndefined();
    expect(parameters.get('malformed')?.type).toBeUndefined();
  });

  it('keeps a schema-backed parameter untyped when its setting type is unmapped', () => {
    const parameters = resolveBlockParameters(
      schema([setting({ id: 'item', type: 'metaobject' })]),
      docs(liquidDoc('item', 'metaobject', true)),
    );

    expect(parameters.get('item')).toMatchObject({ required: true });
    expect(parameters.get('item')?.type).toBeUndefined();
  });
});

function liquidDoc(name: string, type: string | null, required: boolean) {
  return {
    nodeType: 'param' as const,
    name,
    description: null,
    type,
    required,
  };
}
