import { LiquidHtmlNode, LiquidRawTag } from '@shopify/liquid-html-parser';
import { getSchema } from './to-schema';
import {
  Check,
  Context,
  LiquidSchemaNode,
  Schema,
  SectionSchema,
  SourceCodeType,
  ThemeBlockSchema,
} from './types';

/**
 * Transforms a LiquidHtml check's optional `LiquidSchema` method into a
 * standard `LiquidRawTag` visitor that bakes in the schema-loading preamble.
 *
 * Users can declare a `LiquidSchema` method on their check:
 *
 * ```ts
 * create(context) {
 *   return {
 *     async LiquidSchema({ validSchema, ast, offset }) {
 *       // runs only after getSchema() resolved and validSchema/ast
 *       // are both non-Error
 *     },
 *   };
 * }
 * ```
 *
 * and this helper composes it with any existing `LiquidRawTag` method so
 * the core visitor (`visitLiquid`) does not need to know about schemas.
 *
 * If the check does not declare `LiquidSchema`, returns the check unchanged.
 * If the check declares both `LiquidSchema` and `LiquidRawTag`, the
 * existing `LiquidRawTag` method runs first for every raw tag, then the
 * schema preamble runs and `LiquidSchema` fires only for valid schemas.
 */
export function wrapLiquidSchema<S extends SourceCodeType>(
  check: Check<S>,
  context: Context<S, Schema>,
): Check<S> {
  if (context.file.type !== SourceCodeType.LiquidHtml) return check;

  const liquidCheck = check as Check<SourceCodeType.LiquidHtml>;
  const schemaMethod = liquidCheck.LiquidSchema;
  if (!schemaMethod) return check;

  const existingLiquidRawTag = liquidCheck.LiquidRawTag;
  const liquidContext = context as unknown as Context<SourceCodeType.LiquidHtml, Schema>;

  const wrappedLiquidRawTag = async (
    node: LiquidRawTag,
    ancestors: LiquidHtmlNode[],
  ): Promise<void> => {
    if (existingLiquidRawTag) {
      await existingLiquidRawTag(node, ancestors);
    }

    if (node.name !== 'schema' || node.body.kind !== 'json') return;

    const schema = await getSchema(liquidContext);
    if (!schema) return;

    const { validSchema, ast } = schema;
    if (!validSchema || validSchema instanceof Error) return;
    if (!ast || ast instanceof Error) return;

    const payload: LiquidSchemaNode = {
      node,
      schema: schema as SectionSchema | ThemeBlockSchema,
      validSchema,
      ast,
      offset: node.blockStartPosition.end,
    };

    await schemaMethod(payload, ancestors);
  };

  return {
    ...liquidCheck,
    LiquidRawTag: wrappedLiquidRawTag,
  } as Check<S>;
}
