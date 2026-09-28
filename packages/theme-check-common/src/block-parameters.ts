import type { DocDefinition, LiquidDocParameter } from './liquid-doc/liquidDoc';
import { parseParamTypeSyntax } from './liquid-doc/utils';
import { schemaSettingLiquidType } from './schema-settings';
import { hasNoSchemaTag } from './to-schema';
import type { Dependencies, Setting, ThemeBlock } from './types';

export const BLOCK_CONTENT_PARAMETER = 'content';

/**
 * A named argument that a `{% block %}` call can pass. Schema settings,
 * LiquidDoc parameters, and the built-in `content` parameter merge by name.
 */
export interface BlockParameter {
  name: string;
  /**
   * The LiquidDoc-syntax type the caller passes, such as `string` or
   * `product[]`. Undefined when the declaration is untyped or unmapped.
   */
  type?: string;
  /**
   * True when LiquidDoc declares the parameter required. Schema-only
   * parameters and built-in `content` without LiquidDoc are optional.
   */
  required: boolean;
  schemaSetting?: Setting.InputSetting;
  liquidDoc?: LiquidDocParameter;
}

export type BlockParameters = Map<string, BlockParameter>;

export type GetBlockParameters = (blockName: string) => Promise<BlockParameters | undefined>;

/**
 * Returns a resolver that loads each block's parameters at most once. Create
 * one per run so later runs see edited blocks.
 */
export function makeGetBlockParameters({
  getBlockSchema,
  getDocDefinition,
}: Pick<Dependencies, 'getBlockSchema' | 'getDocDefinition'>): GetBlockParameters {
  if (!getBlockSchema || !getDocDefinition) return async () => undefined;

  const cache = new Map<string, Promise<BlockParameters | undefined>>();
  const load = async (blockName: string) => {
    const [schema, docDefinition] = await Promise.all([
      getBlockSchema(blockName),
      getDocDefinition(`blocks/${blockName}.liquid`),
    ]);
    if (!schema || !docDefinition) return undefined;
    if (!(schema.validSchema instanceof Error)) {
      return resolveBlockParameters(schema.validSchema, docDefinition);
    }

    return hasNoSchemaTag(schema) ? resolveBlockParameters(undefined, docDefinition) : undefined;
  };

  return (blockName) => {
    if (!cache.has(blockName)) cache.set(blockName, load(blockName));
    return cache.get(blockName)!;
  };
}

/**
 * Merges a block's parameter sources. Schema settings own type and merchant
 * visibility. LiquidDoc owns requiredness for every parameter it declares.
 * Schema-only parameters and built-in `content` without LiquidDoc are optional.
 */
export function resolveBlockParameters(
  schema: ThemeBlock.Schema | undefined,
  docDefinition?: DocDefinition,
): BlockParameters {
  const parameters: BlockParameters = new Map([
    [BLOCK_CONTENT_PARAMETER, { name: BLOCK_CONTENT_PARAMETER, type: 'string', required: false }],
  ]);

  for (const setting of schema?.settings ?? []) {
    if (!isInputSetting(setting)) continue;

    parameters.set(setting.id, {
      name: setting.id,
      type:
        setting.id === BLOCK_CONTENT_PARAMETER ? 'string' : schemaSettingLiquidType(setting.type),
      required: false,
      schemaSetting: setting,
    });
  }

  for (const liquidDoc of docDefinition?.liquidDoc?.parameters ?? []) {
    parameters.set(liquidDoc.name, withLiquidDoc(parameters.get(liquidDoc.name), liquidDoc));
  }

  return parameters;
}

/**
 * Lowercases a LiquidDoc type such as `Product[]`. Returns undefined for an
 * omitted or malformed type so callers do not report speculative mismatches.
 */
export function liquidDocType(type: string | null | undefined): string | undefined {
  const normalizedType = type?.toLowerCase();
  return normalizedType && parseParamTypeSyntax(normalizedType) ? normalizedType : undefined;
}

function withLiquidDoc(
  existing: BlockParameter | undefined,
  liquidDoc: LiquidDocParameter,
): BlockParameter {
  if (existing) return { ...existing, required: liquidDoc.required, liquidDoc };

  return {
    name: liquidDoc.name,
    type: liquidDocType(liquidDoc.type),
    required: liquidDoc.required,
    liquidDoc,
  };
}

function isInputSetting(setting: Setting.Any): setting is Setting.InputSetting {
  return (
    typeof setting.id === 'string' && setting.type !== 'header' && setting.type !== 'paragraph'
  );
}
