// These are the from `@types/json-to-ast`
export type JSONNodeTypes = 'Object' | 'Array' | 'Property' | 'Identifier' | 'Literal';
export type JSONNode = ArrayNode | IdentifierNode | LiteralNode | ObjectNode | PropertyNode;
export type ValueNode = ObjectNode | ArrayNode | LiteralNode;

export interface Position {
  offset: number;
}

export interface Location {
  start: Position;
  end: Position;
}

export interface ASTNode {
  type: string;
  // Modified from @types/json-to-ast make this not-optional
  loc: Location;
}

export interface ObjectNode extends ASTNode {
  type: 'Object';
  children: PropertyNode[];
}

export interface PropertyNode extends ASTNode {
  type: 'Property';
  key: IdentifierNode;
  value: ValueNode;
}

export interface IdentifierNode extends ASTNode {
  type: 'Identifier';
  value: string;
  raw: string;
}

export interface ArrayNode extends ASTNode {
  type: 'Array';
  children: ValueNode[];
}

export interface LiteralNode extends ASTNode {
  type: 'Literal';
  value: string | number | boolean | null;
  raw: string;
}
