import {
  BLOCK_CONTENT_PARAMETER,
  BlockParameter,
  BlockParameters,
  GetDocDefinitionForURI,
  isBlockSchema,
  makeGetBlockParameters,
  Setting,
} from '@shopify/theme-check-common';
import { GetThemeBlockSchema } from '../json/JSONContributions';
import { formatLiquidDocParameter } from './liquidDoc';
import { blockName } from './uri';

/** Resolves the parameters that a `block` tag in `uri` can pass to `blockName`. */
export type GetBlockParametersForURI = (
  uri: string,
  blockName: string,
) => Promise<BlockParameters | undefined>;

/**
 * Returns a lookup that creates a new block parameter resolver on every call.
 * Each completion or hover request makes one call, so the next request sees
 * edits to the target block instead of a stale interface.
 */
export function makeGetBlockParametersForURI(
  getThemeBlockSchema: GetThemeBlockSchema,
  getDocDefinitionForURI: GetDocDefinitionForURI,
): GetBlockParametersForURI {
  return (uri, targetBlockName) => {
    const getBlockParameters = makeGetBlockParameters({
      async getBlockSchema(name) {
        const schema = await getThemeBlockSchema(uri, name);
        return isBlockSchema(schema) ? schema : undefined;
      },
      getDocDefinition: (relativePath) =>
        getDocDefinitionForURI(uri, 'blocks', blockName(relativePath)),
    });

    return getBlockParameters(targetBlockName);
  };
}

/**
 * Markdown documentation for a block parameter. Schema owns the type and the
 * merchant-facing details; LiquidDoc owns the description and requiredness.
 */
export function formatBlockParameter(parameter: BlockParameter): string {
  const heading = formatLiquidDocParameter(
    {
      nodeType: 'param',
      name: parameter.name,
      type: parameter.type ?? null,
      description: parameter.liquidDoc?.description ?? null,
      required: parameter.required,
    },
    true,
  );

  return [heading, ...sourceNotes(parameter)].join('\n\n');
}

const BUILT_IN_CONTENT_NOTE =
  'Built-in parameter. A non-empty block body supplies `content` and takes precedence over a `content:` argument.';

const DEVELOPER_ONLY_NOTE = 'Developer-only LiquidDoc parameter. Not merchant-facing.';

function sourceNotes(parameter: BlockParameter): string[] {
  const { name, schemaSetting } = parameter;
  const notes: string[] = [];
  if (schemaSetting) notes.push(merchantSettingNote(schemaSetting));
  if (name === BLOCK_CONTENT_PARAMETER) notes.push(BUILT_IN_CONTENT_NOTE);
  if (!schemaSetting && name !== BLOCK_CONTENT_PARAMETER) notes.push(DEVELOPER_ONLY_NOTE);
  return notes;
}

function merchantSettingNote(setting: Setting.InputSetting): string {
  const details = [
    setting.label ? `- Label: ${setting.label}` : undefined,
    setting.info ? `- Info: ${setting.info}` : undefined,
  ].filter((detail): detail is string => detail !== undefined);

  return [`**Merchant-facing setting** (\`${setting.type}\`)`, ...details].join('\n');
}
