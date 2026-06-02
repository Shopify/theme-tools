import { NodeTypes, type ContentForMarkup, type LiquidTag } from './parser-compat';
import type { Context } from './context';
import { argHasBareArrayAccess } from './utils';

const ACCEPTED_CONTENT_FOR_TYPES = new Set(['block', 'blocks']);
const RESERVED_BLOCK_ATTRIBUTES = new Set(['block', 'schema']);
const CONTENT_FOR_CLOSEST_PREFIX = 'closest.';
const CONTENT_FOR_METAOBJECT_CLOSEST_PREFIX = 'metaobject.';

const CONTENT_FOR_CLOSEST_RESOURCE_TYPES = new Set([
  'article',
  'blog',
  'collection',
  'page',
  'product',
]);

export function checkContentForTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    context.report({
      message: "Syntax error in 'content_for' tag",
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  const markup = node.markup as ContentForMarkup;
  const contentForType = markup.contentForType.value;

  // Parseable but unsupported values
  if (!ACCEPTED_CONTENT_FOR_TYPES.has(contentForType)) {
    reportUnsupportedContentForType(node, context, contentForType);
    return;
  }

  if (hasInvalidSharedArguments(markup)) {
    report(node, context);
    return;
  }

  if (contentForType === 'block' && hasInvalidBlockArguments(markup)) {
    report(node, context);
    return;
  }

  if (contentForType === 'blocks' && hasInvalidBlocksArguments(markup)) {
    report(node, context);
  }
}

function hasInvalidSharedArguments(markup: ContentForMarkup): boolean {
  return hasDuplicateArguments(markup) || markup.args.some(argHasBareArrayAccess);
}

function hasDuplicateArguments(markup: ContentForMarkup): boolean {
  const seen = new Set<string>();
  for (const arg of markup.args) {
    if (seen.has(arg.name)) return true;
    seen.add(arg.name);
  }
  return false;
}

function hasInvalidBlockArguments(markup: ContentForMarkup): boolean {
  return hasReservedBlockArgument(markup) || hasInvalidBlockStaticArguments(markup);
}

function hasReservedBlockArgument(markup: ContentForMarkup): boolean {
  return markup.args.some((arg) => RESERVED_BLOCK_ATTRIBUTES.has(arg.name));
}

function hasInvalidBlockStaticArguments(markup: ContentForMarkup): boolean {
  const typeArg = markup.args.find((arg) => arg.name === 'type');
  const idArg = markup.args.find((arg) => arg.name === 'id');

  if (!typeArg || !idArg) return true;
  if (typeArg.value.type !== NodeTypes.String || idArg.value.type !== NodeTypes.String) return true;
  if (typeArg.value.value === '' || idArg.value.value === '') return true;

  return false;
}

function hasInvalidBlocksArguments(markup: ContentForMarkup): boolean {
  let contextArgumentCount = 0;

  for (const arg of markup.args) {
    if (!arg.name.startsWith(CONTENT_FOR_CLOSEST_PREFIX)) return true;
    if (arg.value.type === NodeTypes.String) return true;

    contextArgumentCount += 1;
    if (contextArgumentCount > 1) return true;

    if (!isSupportedClosestArgument(arg.name)) return true;
  }

  return false;
}

function isSupportedClosestArgument(name: string): boolean {
  const closestType = name.slice(CONTENT_FOR_CLOSEST_PREFIX.length);

  return (
    CONTENT_FOR_CLOSEST_RESOURCE_TYPES.has(closestType) ||
    closestType.startsWith(CONTENT_FOR_METAOBJECT_CLOSEST_PREFIX)
  );
}

function reportUnsupportedContentForType(
  node: LiquidTag,
  context: Context,
  contentForType: string,
): void {
  context.report({
    message: `Invalid content_for type "${contentForType}"; expected "block" or "blocks"`,
    startIndex: node.position.start,
    endIndex: node.position.end,
  });
}

function report(node: LiquidTag, context: Context): void {
  context.report({
    message: "Syntax error in 'content_for' tag",
    startIndex: node.position.start,
    endIndex: node.position.end,
  });
}
