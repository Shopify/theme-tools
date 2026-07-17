import {
  builtinTags,
  NodeTypes,
  type LiquidStatement,
  type LiquidTag,
} from '@shopify/liquid-html-parser';
import type { Context } from '.';

const reportedUnknownLiquidBlockTags = new WeakSet<LiquidTag>();

export async function checkBaseTag(node: LiquidTag, context: Context): Promise<void> {
  if ('reason' in node && typeof node.reason === 'string') {
    context.report({
      message: node.reason,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (node.name === 'liquid' && Array.isArray(node.markup)) {
    await checkUnknownTagsInsideLiquidBlock(node.markup, context);
    return;
  }

  const knownLiquidTags = await knownLiquidTagsFor(context);
  if (reportedUnknownLiquidBlockTags.has(node)) return;

  if (isUnknownTagInsideLiquidBlock(node, knownLiquidTags)) {
    reportedUnknownLiquidBlockTags.add(node);
    context.report({
      message: `Unknown tag '${node.name}'`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}

async function checkUnknownTagsInsideLiquidBlock(
  statements: LiquidStatement[],
  context: Context,
): Promise<void> {
  const knownLiquidTags = await knownLiquidTagsFor(context);

  for (const statement of statements) {
    if (
      statement.type === NodeTypes.LiquidTag &&
      !reportedUnknownLiquidBlockTags.has(statement) &&
      isUnknownTagInsideLiquidBlock(statement, knownLiquidTags)
    ) {
      reportedUnknownLiquidBlockTags.add(statement);
      context.report({
        message: `Unknown tag '${statement.name}'`,
        startIndex: statement.position.start,
        endIndex: statement.position.end,
      });
    }
  }
}

async function knownLiquidTagsFor(context: Context): Promise<Set<string>> {
  const tags = context.themeDocset
    ? await context.themeDocset.tags()
    : Object.keys(builtinTags).map((name) => ({ name }));
  return new Set(['#', 'else', 'elsif', 'when', ...tags.map((tag) => tag.name)]);
}

function isUnknownTagInsideLiquidBlock(node: LiquidTag, knownLiquidTags: Set<string>): boolean {
  // Statements inside `{% liquid %}` do not have their own `{%` delimiter.
  if (node.source.startsWith('{%', node.position.start)) return false;

  return !knownLiquidTags.has(node.name);
}
