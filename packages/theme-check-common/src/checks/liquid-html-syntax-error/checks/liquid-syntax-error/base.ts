import type { LiquidTag } from './parser-compat';
import type { Context } from './context';

const BUILTIN_TAGS = [
  'assign',
  'break',
  'capture',
  'case',
  'comment',
  'continue',
  'content_for',
  'cycle',
  'decrement',
  'doc',
  'echo',
  'elsif',
  'for',
  'form',
  'if',
  'ifchanged',
  'include',
  'increment',
  'javascript',
  'layout',
  'liquid',
  'paginate',
  'raw',
  'render',
  'schema',
  'section',
  'sections',
  'style',
  'stylesheet',
  'tablerow',
  'unless',
  'when',
];

const KNOWN_LIQUID_TAGS = new Set(['#', ...BUILTIN_TAGS]);

export function checkBaseTag(node: LiquidTag, context: Context): void {
  if ('reason' in node && typeof node.reason === 'string') {
    context.report({
      message: node.reason,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (isUnknownTagInsideLiquidBlock(node)) {
    context.report({
      message: `Unknown tag '${node.name}'`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}

function isUnknownTagInsideLiquidBlock(node: LiquidTag): boolean {
  // Statements inside `{% liquid %}` do not have their own `{%` delimiter.
  return !node.source.startsWith('{%', node.position.start) && !KNOWN_LIQUID_TAGS.has(node.name);
}
