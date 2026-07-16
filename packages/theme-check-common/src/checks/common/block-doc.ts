import type { LiquidCheckDefinition } from "@shopify/theme-check-common";
import { extractDocDefinition } from "@shopify/theme-check-common/dist/liquid-doc/liquidDoc";
import type { LiquidDocParameter } from "@shopify/theme-check-common/dist/liquid-doc/liquidDoc";
import { toLiquidHtmlAST } from "@editor/liquid-html-parser";

export type CheckContext = Parameters<
  Extract<LiquidCheckDefinition["create"], (...args: any[]) => any>
>[0];

export function isSystemArg(name: string): boolean {
  return name.startsWith("block.");
}

/*
 * Resolves the {% doc %} parameters for a block
 * template by reading and parsing its source file.
 *
 * Returns undefined if the block file does not
 * exist, cannot be parsed, or has no {% doc %} tag.
 */
export async function getBlockDocParams(
  context: CheckContext,
  blockName: string,
): Promise<Map<string, LiquidDocParameter> | undefined> {
  const relativePath = `blocks/${blockName}.liquid`;
  const uri = context.toUri(relativePath);

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

  const docDef = extractDocDefinition(uri, ast);
  const params = docDef?.liquidDoc?.parameters;
  if (!params || params.length === 0) return undefined;

  return new Map(params.map((p) => [p.name, p]));
}
