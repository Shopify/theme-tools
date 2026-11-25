/**
 * Factory functions for LiquidDoc AST nodes.
 *
 * Follows the same pattern as document/factories.ts — pure constructors,
 * no parsing logic.
 */

import { NodeTypes } from '../types';
import type {
  TextNode,
  LiquidDocParamNode,
  LiquidDocDescriptionNode,
  LiquidDocExampleNode,
  LiquidDocPromptNode,
} from '../ast';

export function makeTextNode(value: string, start: number, end: number, source: string): TextNode {
  return {
    type: NodeTypes.TextNode,
    value,
    position: { start, end },
    source,
  };
}

export function makeLiquidDocParamNode(
  paramName: TextNode,
  paramType: TextNode | null,
  paramDescription: TextNode | null,
  required: boolean,
  start: number,
  end: number,
  source: string,
): LiquidDocParamNode {
  return {
    type: NodeTypes.LiquidDocParamNode,
    name: 'param',
    paramName,
    paramType,
    paramDescription,
    required,
    position: { start, end },
    source,
  };
}

export function makeLiquidDocDescriptionNode(
  content: TextNode,
  isImplicit: boolean,
  isInline: boolean,
  start: number,
  end: number,
  source: string,
): LiquidDocDescriptionNode {
  return {
    type: NodeTypes.LiquidDocDescriptionNode,
    name: 'description',
    content,
    isImplicit,
    isInline,
    position: { start, end },
    source,
  };
}

export function makeLiquidDocExampleNode(
  content: TextNode,
  isInline: boolean,
  start: number,
  end: number,
  source: string,
): LiquidDocExampleNode {
  return {
    type: NodeTypes.LiquidDocExampleNode,
    name: 'example',
    content,
    isInline,
    position: { start, end },
    source,
  };
}

export function makeLiquidDocPromptNode(
  content: TextNode,
  start: number,
  end: number,
  source: string,
): LiquidDocPromptNode {
  return {
    type: NodeTypes.LiquidDocPromptNode,
    name: 'prompt',
    content,
    position: { start, end },
    source,
  };
}
