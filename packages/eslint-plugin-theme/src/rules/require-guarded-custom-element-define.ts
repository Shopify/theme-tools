import type { Rule } from 'eslint';
import type { BlockStatement, CallExpression, Expression, Node, Statement } from 'estree';
import { isGlobalObject } from '../utils/dom-lookups';
import {
  getIndentUnit,
  getLineIndentation,
  statementAlwaysExits,
  walkSubtree,
  type NodeWithParent,
} from '../utils/lifecycle';

const SAFE_WRAP_PARENTS = new Set(['Program', 'BlockStatement', 'SwitchCase', 'StaticBlock']);

function isCustomElementsObject(node: Node): boolean {
  if (node.type === 'Identifier' && node.name === 'customElements') return true;
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === 'customElements' &&
    node.object.type !== 'Super' &&
    isGlobalObject(node.object)
  ) {
    return true;
  }
  return false;
}

function isCustomElementsMethod(node: CallExpression, methodName: string): boolean {
  return (
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === methodName &&
    isCustomElementsObject(node.callee.object)
  );
}

function getNormalizedTagKey(
  node: Node | undefined,
  sourceCode: Rule.RuleContext['sourceCode'],
): string | null {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return `str:${node.value}`;
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return `str:${node.quasis[0]?.value.cooked ?? ''}`;
  }
  return `expr:${sourceCode.getText(node).replace(/\s+/g, '')}`;
}

function isMatchingCustomElementsGet(
  node: Node,
  expectedTagKey: string,
  sourceCode: Rule.RuleContext['sourceCode'],
): boolean {
  if (node.type !== 'CallExpression' || !isCustomElementsMethod(node, 'get')) return false;
  const arg = node.arguments[0];
  if (!arg || arg.type === 'SpreadElement') return false;
  const key = getNormalizedTagKey(arg, sourceCode);
  return key !== null && key === expectedTagKey;
}

/**
 * Evaluates whether `expr` checks that `customElements.get(tag)` is falsy (`wantFalsy = true`)
 * or truthy (`wantFalsy = false`) for the matching `expectedTagKey`.
 */
function exprChecksDefineGuard(
  expr: Node,
  expectedTagKey: string,
  wantFalsy: boolean,
  sourceCode: Rule.RuleContext['sourceCode'],
): boolean {
  if (expr.type === 'ChainExpression') {
    return exprChecksDefineGuard(expr.expression, expectedTagKey, wantFalsy, sourceCode);
  }

  // `customElements.get(tag)` -> truthy when defined
  if (isMatchingCustomElementsGet(expr, expectedTagKey, sourceCode)) {
    return !wantFalsy;
  }

  // `!customElements.get(tag)`
  if (expr.type === 'UnaryExpression' && expr.operator === '!') {
    return exprChecksDefineGuard(expr.argument, expectedTagKey, !wantFalsy, sourceCode);
  }

  // `customElements.get(tag) === undefined` / `== null` / `!== undefined` / `!= null`
  if (expr.type === 'BinaryExpression') {
    const isNullish = (n: Node) =>
      (n.type === 'Literal' && n.value === null) ||
      (n.type === 'Identifier' && n.name === 'undefined') ||
      (n.type === 'UnaryExpression' && n.operator === 'void');

    const leftIsGet = isMatchingCustomElementsGet(expr.left, expectedTagKey, sourceCode);
    const rightIsGet = isMatchingCustomElementsGet(expr.right, expectedTagKey, sourceCode);

    if ((leftIsGet && isNullish(expr.right)) || (rightIsGet && isNullish(expr.left))) {
      if (expr.operator === '===' || expr.operator === '==') return wantFalsy;
      if (expr.operator === '!==' || expr.operator === '!=') return !wantFalsy;
    }
  }

  if (expr.type === 'LogicalExpression') {
    if (expr.operator === '&&') {
      return (
        exprChecksDefineGuard(expr.left, expectedTagKey, wantFalsy, sourceCode) ||
        exprChecksDefineGuard(expr.right, expectedTagKey, wantFalsy, sourceCode)
      );
    }
    if (expr.operator === '||') {
      return (
        exprChecksDefineGuard(expr.left, expectedTagKey, wantFalsy, sourceCode) &&
        exprChecksDefineGuard(expr.right, expectedTagKey, wantFalsy, sourceCode)
      );
    }
  }

  return false;
}

function isSideEffectFreeTagExpr(expr: Expression): boolean {
  if (expr.type === 'Literal' && typeof expr.value === 'string') return true;
  if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0) return true;
  if (expr.type === 'Identifier') return true;
  if (
    expr.type === 'MemberExpression' &&
    !expr.computed &&
    expr.object.type !== 'Super' &&
    isSideEffectFreeTagExpr(expr.object)
  ) {
    return true;
  }
  return false;
}

function containsMultilineTemplateLiteral(node: Node): boolean {
  return walkSubtree(node, (n) => {
    if (n.type === 'TemplateLiteral') {
      return n.quasis.some((q) => q.value.raw.includes('\n') || q.value.raw.includes('\r'));
    }
  });
}

function isDefineGuarded(
  callNode: CallExpression & { parent?: NodeWithParent },
  tagKey: string,
  sourceCode: Rule.RuleContext['sourceCode'],
): boolean {
  let current: NodeWithParent | undefined = callNode;
  while (current?.parent) {
    const parent: NodeWithParent = current.parent;

    if (parent.type === 'IfStatement') {
      if (
        parent.consequent === current &&
        exprChecksDefineGuard(parent.test, tagKey, true, sourceCode)
      ) {
        return true;
      }
      if (
        parent.alternate === current &&
        exprChecksDefineGuard(parent.test, tagKey, false, sourceCode)
      ) {
        return true;
      }
    }

    if (parent.type === 'TryStatement' && parent.block === current) {
      return true;
    }

    if (parent.type === 'LogicalExpression' && parent.right === current) {
      // `customElements.get(tag) || customElements.define(tag, ...)`
      if (
        (parent.operator === '||' || parent.operator === '??') &&
        exprChecksDefineGuard(parent.left, tagKey, false, sourceCode)
      ) {
        return true;
      }
      // `!customElements.get(tag) && customElements.define(tag, ...)`
      if (
        parent.operator === '&&' &&
        exprChecksDefineGuard(parent.left, tagKey, true, sourceCode)
      ) {
        return true;
      }
    }

    if (parent.type === 'ConditionalExpression') {
      if (
        parent.consequent === current &&
        exprChecksDefineGuard(parent.test, tagKey, true, sourceCode)
      ) {
        return true;
      }
      if (
        parent.alternate === current &&
        exprChecksDefineGuard(parent.test, tagKey, false, sourceCode)
      ) {
        return true;
      }
    }

    if (parent.type === 'BlockStatement') {
      const block = parent as BlockStatement;
      const idx = block.body.indexOf(current as Statement);
      for (let i = idx - 1; i >= 0; i--) {
        const prev = block.body[i];
        if (
          prev.type === 'IfStatement' &&
          statementAlwaysExits(prev.consequent) &&
          exprChecksDefineGuard(prev.test, tagKey, false, sourceCode)
        ) {
          return true;
        }
      }
    }

    current = parent;
  }
  return false;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'Require guarding customElements.define() with customElements.get() to prevent errors when scripts re-execute',
      recommended: true,
      url: 'https://github.com/Shopify/theme-tools/blob/main/packages/eslint-plugin-theme/docs/rules/require-guarded-custom-element-define.md',
    },
    schema: [],
    messages: {
      unguardedDefine:
        "Unguarded customElements.define({{tag}}). If a section's script re-executes during a dynamic update, redefining an existing custom element throws a DOMException. Guard it with `if (!customElements.get({{tag}})) { ... }`.",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        if (!isCustomElementsMethod(node, 'define')) return;

        const tagArg = node.arguments[0];
        if (!tagArg || tagArg.type === 'SpreadElement') return;

        const tagKey = getNormalizedTagKey(tagArg, sourceCode);
        if (!tagKey) return;

        const call = node as CallExpression & { parent?: NodeWithParent };
        if (isDefineGuarded(call, tagKey, sourceCode)) return;

        const tagText = sourceCode.getText(tagArg);
        const parent = call.parent;
        // Require a block-like parent so wrapping never introduces a dangling `else`.
        const canFix =
          parent?.type === 'ExpressionStatement' &&
          Boolean(parent.parent && SAFE_WRAP_PARENTS.has(parent.parent.type)) &&
          isSideEffectFreeTagExpr(tagArg) &&
          Boolean(parent.range) &&
          Boolean(parent.loc);

        const registryText = sourceCode.getText((node.callee as { object: Node }).object);

        context.report({
          node,
          messageId: 'unguardedDefine',
          data: { tag: tagText },
          fix: canFix
            ? (fixer) => {
                const stmt = parent!;
                const indent = getLineIndentation(stmt, sourceCode);
                const unit = getIndentUnit(indent);
                const stmtText = sourceCode.getText(stmt);
                const hasMultilineTpl = containsMultilineTemplateLiteral(stmt);

                // Avoid re-indenting inner lines when a multiline template literal is present,
                // because prepending spaces would mutate runtime template string contents.
                const body = hasMultilineTpl
                  ? `${indent}${stmtText}`
                  : stmtText
                      .split(/\r?\n/)
                      .map((line, i) =>
                        i === 0
                          ? `${indent}${unit}${line}`
                          : line.length > 0
                            ? `${unit}${line}`
                            : line,
                      )
                      .join('\n');

                return fixer.replaceText(
                  stmt,
                  `if (!${registryText}.get(${tagText})) {\n${body}\n${indent}}`,
                );
              }
            : undefined,
        });
      },
    };
  },
};

export default rule;
