import { isArrayNode, isLiteralNode, isObjectNode, SourceCodeType } from '../../types';
import { toJSONAST } from '../../to-source-code';
import { visit } from '../../visitor';
import { toLiquidHtmlAST, type LiquidRawTag } from '@shopify/liquid-html-parser';
import type { CheckContext } from './block-doc';

/*
 * Resolves the {% schema %} setting ids for a block template by reading
 * and parsing its source file. Only top-level settings entries that carry
 * an id are returned; header and paragraph entries and settings nested
 * under blocks or presets are excluded, mirroring ExcessiveSettingsCount.
 *
 * Returns undefined only when the schema cannot be resolved: the block
 * file is missing, the source is unparseable, there is no {% schema %}
 * tag, or the schema JSON does not parse to an object. Returns an empty
 * Set when the schema parses to an object but has no settings array, or
 * when the settings array declares no id-bearing entries -- both mean
 * the schema is known and carries zero setting ids.
 */
export async function getBlockSchemaSettings(
  context: CheckContext,
  blockName: string,
): Promise<Set<string> | undefined> {
  const uri = context.toUri(`blocks/${blockName}.liquid`);

  let source: string;
  try {
    source = await context.fs.readFile(uri);
  } catch {
    return undefined;
  }

  let ast: ReturnType<typeof toLiquidHtmlAST>;
  try {
    ast = toLiquidHtmlAST(source);
  } catch {
    return undefined;
  }

  const schemaNode = visit<SourceCodeType.LiquidHtml, LiquidRawTag>(ast, {
    LiquidRawTag(node) {
      if (node.name === 'schema') return node;
    },
  })[0];
  if (!schemaNode) return undefined;

  const schemaAst = toJSONAST(schemaNode.body.value);
  if (schemaAst instanceof Error || !isObjectNode(schemaAst)) return undefined;

  const settingsProperty = schemaAst.children.find((property) => property.key.value === 'settings');
  if (!settingsProperty || !isArrayNode(settingsProperty.value)) return new Set<string>();

  const ids = new Set<string>();
  for (const setting of settingsProperty.value.children) {
    if (!isObjectNode(setting)) continue;
    const idProp = setting.children.find((property) => property.key.value === 'id');
    if (idProp && isLiteralNode(idProp.value) && typeof idProp.value.value === 'string') {
      ids.add(idProp.value.value);
    }
  }
  return ids;
}
