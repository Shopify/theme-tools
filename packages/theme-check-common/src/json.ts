import { parse, ParseError } from 'jsonc-parser';
import { JSONNode } from './types';
import { asError } from './utils';

const PARSE_OPTS = {
  disallowComments: false,
  allowTrailingComma: true,
  allowEmptyContent: false,
};

export function parseJSON(source: string): any | Error;
export function parseJSON(source: string, defaultValue: any): any;
export function parseJSON(source: string, defaultValue?: any): any | Error {
  try {
    /**
     * The jsonc-parser is fault-tolerant and typically returns a valid
     * result. However, it also mutates the 'errors' array with any
     * errors it encounters during parsing.
     */
    const errors: ParseError[] = [];
    const result = parse(source, errors, PARSE_OPTS);

    if (errors.length) {
      throw errors[0];
    }

    return result;
  } catch (error) {
    if (defaultValue !== undefined) return defaultValue;
    return asError(error);
  }
}

/**
 * Given a known path to a property and an ast, returns the AST node at that path.
 *
 * @example
 * const nameNode = nodeAtPath(ast, ['name'])! as LiteralNode;
 * const blocksNode = nodeAtPath(ast, ['blocks'])! as ArrayNode;
 * const someDeepNode = nodeAtPath(ast, ['blocks', 0, 'settings', 'someDeepKey'])! as LiteralNode;
 */
export function nodeAtPath(node: JSONNode, path: string[]): JSONNode | undefined {
  return path.reduce<JSONNode | undefined>((acc, key) => {
    if (!acc || acc.type !== 'Object') return;
    const property = acc.children.find((child) => child.key.value === key);
    if (!property) return;
    return property.value;
  }, node);
}

/** Given a JSONNode, returns the start offset of the node in the source string. */
export function getLocStart(node: JSONNode): number {
  return node.loc?.start.offset ?? 0;
}

/** Given a JSONNode, returns the end offset of the node in the source string. */
export function getLocEnd(node: JSONNode): number {
  return node.loc?.end.offset ?? 0;
}
