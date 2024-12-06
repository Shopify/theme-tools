import { assertNever } from '../utils';
import {
  ArrayNode,
  IdentifierNode,
  JSONNode as JSONToASTNode,
  LiteralNode,
  ObjectNode,
  PropertyNode,
  ValueNode,
} from './types';
import { Node as JSONCParserNode, ParseError, parseTree } from 'jsonc-parser';

export class JSONCParseErrors extends Error {
  public errors: ParseError[];

  constructor(message: string, errors: ParseError[]) {
    super(message);
    this.errors = errors;
  }
}

/**
 * At some point, we started supporting JSONC. Theme Check 2 was built on top of
 * `json-to-ast` which does not support comments.
 *
 * This little adapter here will take a tree we get from `jsonc-parser` and
 * convert it to the shape of `json-to-ast`.
 *
 * The `json-to-ast` types feel much better to use than the ones from `jsonc-parser`
 * and we don't need to rewrite all our downstream code.
 */
export function toJSONNode(source: string): JSONToASTNode {
  const errors: ParseError[] = [];
  const tree = parseTree(source, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (errors.length || tree === undefined) {
    throw new JSONCParseErrors('Failed to parse JSONC', errors);
  }

  return jsoncToJsonAst(tree);
}

function jsoncToJsonAst(node: JSONCParserNode): JSONToASTNode {
  switch (node.type) {
    case 'object': {
      return objectToObjectNode(node);
    }

    case 'property': {
      return propertyToPropertyNode(node);
    }

    case 'array': {
      return arrayToArrayNode(node);
    }

    case 'boolean':
    case 'null':
    case 'number':
    case 'string': {
      return valueToLiteralNode(node);
    }

    default: {
      assertNever(node.type);
    }
  }
}

function objectToObjectNode(node: JSONCParserNode): ObjectNode {
  return {
    type: 'Object',
    children: (node.children ?? []).map(jsoncToJsonAst) as PropertyNode[],
    loc: location(node.offset, node.offset + node.length),
  };
}

function arrayToArrayNode(node: JSONCParserNode): ArrayNode {
  return {
    type: 'Array',
    children: node.children!.map(jsoncToJsonAst) as ValueNode[],
    loc: location(node.offset, node.offset + node.length),
  };
}

function propertyToPropertyNode(node: JSONCParserNode): PropertyNode {
  return {
    type: 'Property',
    key: identifierToIdentifierNode(node.children![0]),
    value: jsoncToJsonAst(node.children![1]) as ValueNode,
    loc: location(node.offset, node.offset + node.length),
  };
}

function identifierToIdentifierNode(node: JSONCParserNode): IdentifierNode {
  return {
    type: 'Identifier',
    value: node.value,
    raw: JSON.stringify(node.value),
    loc: location(node.offset, node.offset + node.length),
  };
}

function valueToLiteralNode(node: JSONCParserNode): LiteralNode {
  return {
    type: 'Literal',
    value: node.value,
    raw: JSON.stringify(node.value),
    loc: location(node.offset, node.offset + node.length),
  };
}

export const location = (start: number, end: number) => ({
  start: position(start),
  end: position(end),
});

const position = (offset: number) => ({ offset });
