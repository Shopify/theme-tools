import { describe, expect, it } from 'vitest';
import type {
  LiquidVariableLookup,
  LiquidComparison,
  LiquidLogicalExpression,
  LiquidBooleanExpression,
} from '../ast';
import { Comparators, NodeTypes } from '../types';
import {
  type BinaryExpr,
  type ComparisonBinaryExpression,
  type LogicalBinaryExpression,
  EqualityOperator,
  ComparisonOperator,
  LogicalOperator,
  isBinaryExpression,
  adaptConditional,
  adaptComplex,
} from './expression-adapter';

function makeVar(name: string, start: number, end: number, source: string): LiquidVariableLookup {
  return { type: NodeTypes.VariableLookup, name, lookups: [], position: { start, end }, source };
}

function makeComparison(
  left: LiquidVariableLookup,
  op: EqualityOperator | ComparisonOperator,
  right: LiquidVariableLookup,
  source: string,
): ComparisonBinaryExpression {
  return {
    kind: 'comparison',
    left,
    op,
    right,
    position: { start: left.position.start, end: right.position.end },
    source,
  };
}

function makeLogical(
  left: BinaryExpr | LiquidVariableLookup,
  op: LogicalOperator,
  right: BinaryExpr | LiquidVariableLookup,
  source: string,
  opStart = left.position.end + 1,
): LogicalBinaryExpression {
  return {
    kind: 'logical',
    left,
    op,
    right,
    opStart,
    position: { start: left.position.start, end: right.position.end },
    source,
  };
}

describe('Unit: expression-adapter', () => {
  describe('isBinaryExpression', () => {
    it('returns true for BinaryExpr objects', () => {
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 5, 6, 'test');
      const bin = makeComparison(a, EqualityOperator.Equal, b, 'test');
      expect(isBinaryExpression(bin)).toBe(true);
    });

    it('returns false for LiquidExpression objects', () => {
      const v = makeVar('x', 0, 1, 'test');
      expect(isBinaryExpression(v)).toBe(false);
    });
  });

  describe('adaptConditional', () => {
    it('passes through plain LiquidExpression unchanged', () => {
      const v = makeVar('x', 0, 1, 'test');
      expect(adaptConditional(v)).toBe(v);
    });

    it('converts comparison with == operator', () => {
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 5, 6, 'test');
      const bin = makeComparison(a, EqualityOperator.Equal, b, 'test');
      const result = adaptConditional(bin) as LiquidComparison;
      expect(result.type).toBe(NodeTypes.Comparison);
      expect(result.comparator).toBe(Comparators.EQUAL);
      expect(result.left).toBe(a);
      expect(result.right).toBe(b);
    });

    it('converts comparison with != operator', () => {
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 5, 6, 'test');
      const bin = makeComparison(a, EqualityOperator.NotEqual, b, 'test');
      const result = adaptConditional(bin) as LiquidComparison;
      expect(result.type).toBe(NodeTypes.Comparison);
      expect(result.comparator).toBe(Comparators.NOT_EQUAL);
    });

    it('converts comparison with < operator', () => {
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 5, 6, 'test');
      const bin = makeComparison(a, ComparisonOperator.LessThan, b, 'test');
      const result = adaptConditional(bin) as LiquidComparison;
      expect(result.type).toBe(NodeTypes.Comparison);
      expect(result.comparator).toBe(Comparators.LESS_THAN);
    });

    it('converts comparison with > operator', () => {
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 5, 6, 'test');
      const bin = makeComparison(a, ComparisonOperator.GreaterThan, b, 'test');
      const result = adaptConditional(bin) as LiquidComparison;
      expect(result.type).toBe(NodeTypes.Comparison);
      expect(result.comparator).toBe(Comparators.GREATER_THAN);
    });

    it('converts comparison with <= operator', () => {
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 5, 6, 'test');
      const bin = makeComparison(a, ComparisonOperator.LessThanOrEqual, b, 'test');
      const result = adaptConditional(bin) as LiquidComparison;
      expect(result.type).toBe(NodeTypes.Comparison);
      expect(result.comparator).toBe(Comparators.LESS_THAN_OR_EQUAL);
    });

    it('converts comparison with >= operator', () => {
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 5, 6, 'test');
      const bin = makeComparison(a, ComparisonOperator.GreaterThanOrEqual, b, 'test');
      const result = adaptConditional(bin) as LiquidComparison;
      expect(result.type).toBe(NodeTypes.Comparison);
      expect(result.comparator).toBe(Comparators.GREATER_THAN_OR_EQUAL);
    });

    it('converts comparison with contains operator', () => {
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 5, 6, 'test');
      const bin = makeComparison(a, ComparisonOperator.Contains, b, 'test');
      const result = adaptConditional(bin) as LiquidComparison;
      expect(result.type).toBe(NodeTypes.Comparison);
      expect(result.comparator).toBe(Comparators.CONTAINS);
    });

    it('converts logical and', () => {
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 5, 6, 'test');
      const bin = makeLogical(a, LogicalOperator.And, b, 'test');
      const result = adaptConditional(bin) as LiquidLogicalExpression;
      expect(result.type).toBe(NodeTypes.LogicalExpression);
      expect(result.relation).toBe('and');
      expect(result.left).toBe(a);
      expect(result.right).toBe(b);
    });

    it('converts logical or', () => {
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 5, 6, 'test');
      const bin = makeLogical(a, LogicalOperator.Or, b, 'test');
      const result = adaptConditional(bin) as LiquidLogicalExpression;
      expect(result.type).toBe(NodeTypes.LogicalExpression);
      expect(result.relation).toBe('or');
      expect(result.left).toBe(a);
      expect(result.right).toBe(b);
    });

    it('converts nested comparison and logical tree', () => {
      // a == b and c > d
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 5, 6, 'test');
      const c = makeVar('c', 11, 12, 'test');
      const d = makeVar('d', 15, 16, 'test');
      const cmpLeft = makeComparison(a, EqualityOperator.Equal, b, 'test');
      const cmpRight = makeComparison(c, ComparisonOperator.GreaterThan, d, 'test');
      const root = makeLogical(cmpLeft, LogicalOperator.And, cmpRight, 'test');

      const result = adaptConditional(root) as LiquidLogicalExpression;
      expect(result.type).toBe(NodeTypes.LogicalExpression);
      expect(result.relation).toBe('and');

      const left = result.left as LiquidComparison;
      expect(left.type).toBe(NodeTypes.Comparison);
      expect(left.comparator).toBe(Comparators.EQUAL);
      expect(left.left).toBe(a);
      expect(left.right).toBe(b);

      const right = result.right as LiquidComparison;
      expect(right.type).toBe(NodeTypes.Comparison);
      expect(right.comparator).toBe(Comparators.GREATER_THAN);
      expect(right.left).toBe(c);
      expect(right.right).toBe(d);
    });

    it('converts deeply nested RTL logical tree', () => {
      // a and b or c -> and(a, or(b, c))
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 6, 7, 'test');
      const c = makeVar('c', 11, 12, 'test');
      const orNode = makeLogical(b, LogicalOperator.Or, c, 'test');
      const root = makeLogical(a, LogicalOperator.And, orNode, 'test');

      const result = adaptConditional(root) as LiquidLogicalExpression;
      expect(result.type).toBe(NodeTypes.LogicalExpression);
      expect(result.relation).toBe('and');
      expect(result.left).toBe(a);

      const rightLogical = result.right as LiquidLogicalExpression;
      expect(rightLogical.type).toBe(NodeTypes.LogicalExpression);
      expect(rightLogical.relation).toBe('or');
      expect(rightLogical.left).toBe(b);
      expect(rightLogical.right).toBe(c);
    });

    it('propagates positions through nested tree', () => {
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 10, 20, 'test');
      const c = makeVar('c', 30, 40, 'test');
      const cmp = makeComparison(a, EqualityOperator.Equal, b, 'test');
      // cmp.position = { start: 0, end: 20 }
      const root = makeLogical(cmp, LogicalOperator.And, c, 'test');
      // root.position = { start: 0, end: 40 }

      const result = adaptConditional(root) as LiquidLogicalExpression;
      expect(result.position).toEqual({ start: 0, end: 40 });

      const left = result.left as LiquidComparison;
      expect(left.position).toEqual({ start: 0, end: 20 });
      expect(left.left.position).toEqual({ start: 0, end: 1 });
      expect(left.right.position).toEqual({ start: 10, end: 20 });

      expect(result.right).toBe(c);
      expect(result.right.position).toEqual({ start: 30, end: 40 });
    });
  });

  describe('adaptComplex', () => {
    it('passes through plain LiquidExpression unchanged', () => {
      const v = makeVar('x', 0, 1, 'test');
      expect(adaptComplex(v)).toBe(v);
    });

    it('wraps comparison BinaryExpr in BooleanExpression', () => {
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 5, 6, 'test');
      const bin = makeComparison(a, EqualityOperator.Equal, b, 'test');

      const result = adaptComplex(bin) as LiquidBooleanExpression;
      expect(result.type).toBe(NodeTypes.BooleanExpression);
      expect(result.position).toEqual({ start: 0, end: 6 });
      expect(result.source).toBe('test');

      const condition = result.condition as LiquidComparison;
      expect(condition.type).toBe(NodeTypes.Comparison);
      expect(condition.comparator).toBe(Comparators.EQUAL);
      expect(condition.left).toBe(a);
      expect(condition.right).toBe(b);
    });

    it('wraps logical BinaryExpr in BooleanExpression', () => {
      const a = makeVar('a', 0, 1, 'test');
      const b = makeVar('b', 5, 6, 'test');
      const bin = makeLogical(a, LogicalOperator.Or, b, 'test');

      const result = adaptComplex(bin) as LiquidBooleanExpression;
      expect(result.type).toBe(NodeTypes.BooleanExpression);
      expect(result.position).toEqual({ start: 0, end: 6 });

      const condition = result.condition as LiquidLogicalExpression;
      expect(condition.type).toBe(NodeTypes.LogicalExpression);
      expect(condition.relation).toBe('or');
      expect(condition.left).toBe(a);
      expect(condition.right).toBe(b);
    });
  });
});
