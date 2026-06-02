import type { LiquidRawTag } from './parser-compat';
import type { Context } from './context';
import { liquidTagBodies, liquidTagMarkup } from './utils';

const SYNTAX_ERROR = "Liquid syntax error: Syntax Error in 'schema' - Valid syntax: schema";

export function checkSchemaTag(node: LiquidRawTag, context: Context): void {
  if (node.markup !== '') {
    context.report({
      message: SYNTAX_ERROR,
      startIndex: node.markupPosition.start,
      endIndex: node.markupPosition.end,
    });
  }
}

export function checkSchemaSourceStructure(source: string, context: Context): void {
  const invalidOpening = findInvalidSchemaOpening(source);
  if (!invalidOpening) return;

  context.report({
    message: SYNTAX_ERROR,
    startIndex: invalidOpening.startIndex,
    endIndex: invalidOpening.endIndex,
  });
}

function findInvalidSchemaOpening(source: string): SchemaSourceStructureError | undefined {
  for (const tag of liquidTagBodies(source)) {
    const markup = liquidTagMarkup(tag.body);

    if (
      markup?.tagName === 'schema' &&
      (markup.remainingTokens.length > 0 || markup.hasSkippedCharacters)
    ) {
      return { startIndex: tag.start, endIndex: tag.end };
    }
  }

  return undefined;
}

interface SchemaSourceStructureError {
  startIndex: number;
  endIndex: number;
}
