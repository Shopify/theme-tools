import type {
  LiquidExpression,
  LiquidConditionalExpression,
  ComplexLiquidExpression,
} from '../ast';
import { Comparators, NodeTypes } from '../types';
import type { Position } from '../types';
import { assertNever } from '../utils';

type LogicalRelation = 'and' | 'or';

export enum LogicalOperator {
  And = 'and',
  Or = 'or',
}

export enum EqualityOperator {
  Equal = '==',
  NotEqual = '!=',
}

export enum ComparisonOperator {
  LessThan = '<',
  GreaterThan = '>',
  LessThanOrEqual = '<=',
  GreaterThanOrEqual = '>=',
  Contains = 'contains',
}

export const LOGICAL_OPERATORS = new Set<string>(Object.values(LogicalOperator));
export const EQUALITY_OPERATORS = new Set<string>(Object.values(EqualityOperator));
export const COMPARISON_OPERATORS = new Set<string>(Object.values(ComparisonOperator));

export type BinaryOperator = LogicalOperator | EqualityOperator | ComparisonOperator;

export interface ComparisonBinaryExpression {
  kind: 'comparison';
  left: LiquidExpression;
  op: EqualityOperator | ComparisonOperator;
  right: LiquidExpression;
  position: Position;
  source: string;
}

export interface LogicalBinaryExpression {
  kind: 'logical';
  left: BinaryExpr | LiquidExpression;
  op: LogicalOperator;
  right: BinaryExpr | LiquidExpression;
  /** Start offset of the operator keyword (e.g. `and`/`or`). Used by the
   *  adapter to set the right child LogicalExpression's position.start to
   *  include the preceding operator, matching the original parser. */
  opStart: number;
  position: Position;
  source: string;
}

export type BinaryExpr = ComparisonBinaryExpression | LogicalBinaryExpression;

/** Parser-internal alias for leaf types (strings, numbers, literals, lookups, ranges). */
export type ValueExpression = LiquidExpression;

/** Full parser-internal union: binary expressions or leaf values. */
export type Expression = BinaryExpr | ValueExpression;

export function isBinaryExpression(node: Expression): node is BinaryExpr {
  return 'kind' in node;
}

function toRelation(op: LogicalOperator): LogicalRelation {
  switch (op) {
    case LogicalOperator.And:
      return 'and';
    case LogicalOperator.Or:
      return 'or';
    default:
      return assertNever(op);
  }
}

function toComparators(op: EqualityOperator | ComparisonOperator): Comparators {
  switch (op) {
    case EqualityOperator.Equal:
      return Comparators.EQUAL;
    case EqualityOperator.NotEqual:
      return Comparators.NOT_EQUAL;
    case ComparisonOperator.LessThan:
      return Comparators.LESS_THAN;
    case ComparisonOperator.GreaterThan:
      return Comparators.GREATER_THAN;
    case ComparisonOperator.LessThanOrEqual:
      return Comparators.LESS_THAN_OR_EQUAL;
    case ComparisonOperator.GreaterThanOrEqual:
      return Comparators.GREATER_THAN_OR_EQUAL;
    case ComparisonOperator.Contains:
      return Comparators.CONTAINS;
    default:
      // Lax recovery preserves an unknown operator (`=`, or a bare word like
      // `true`) in the comparison node's `op`. It is not a known comparator, so
      // it cannot be mapped to the `Comparators` enum here; pass the raw string
      // through unchanged so the engine raises `Unknown operator <op>` at
      // evaluate time (mirrors Ruby `condition.rb:186`). Strict parsing never
      // produces an unknown operator, so this branch is lax-condition only.
      return op as unknown as Comparators;
  }
}

export function adaptConditional(node: Expression): LiquidConditionalExpression {
  if (!isBinaryExpression(node)) {
    return node;
  }

  switch (node.kind) {
    case 'logical': {
      const right = adaptConditional(node.right);
      // The original parser sets a nested LogicalExpression's position.start
      // to include the preceding operator keyword (`and`/`or`).
      if (right.type === NodeTypes.LogicalExpression) {
        right.position = { ...right.position, start: node.opStart };
      }
      return {
        type: NodeTypes.LogicalExpression,
        relation: toRelation(node.op),
        left: adaptConditional(node.left),
        right,
        position: node.position,
        source: node.source,
      };
    }
    case 'comparison':
      return {
        type: NodeTypes.Comparison,
        comparator: toComparators(node.op),
        left: node.left,
        right: node.right,
        position: node.position,
        source: node.source,
      };
    default:
      return assertNever(node);
  }
}

export function adaptComplex(node: Expression): ComplexLiquidExpression {
  if (!isBinaryExpression(node)) {
    return node;
  }

  return {
    type: NodeTypes.BooleanExpression,
    condition: adaptConditional(node),
    position: node.position,
    source: node.source,
  };
}
