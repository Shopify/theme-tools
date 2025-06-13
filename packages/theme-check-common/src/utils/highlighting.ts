import { getLocEnd, getLocStart, nodeAtPath } from '..';
import { JSONNode } from '..';
import { Context, SourceCodeType, ArrayNode } from '../types';

export function reportWarning(
  context: Context<SourceCodeType.LiquidHtml>,
  offset: number,
  ast: JSONNode,
  ast_path: string[],
  message: string,
  fullHighlight: boolean = true,
) {
  const node = nodeAtPath(ast, ast_path)! as ArrayNode;
  const startIndex = fullHighlight ? offset + getLocStart(node) : offset + getLocEnd(node) - 1; // start to finish of the node or last char of the node
  const endIndex = offset + getLocEnd(node);
  context.report({
    message: message,
    startIndex,
    endIndex,
  });
}
