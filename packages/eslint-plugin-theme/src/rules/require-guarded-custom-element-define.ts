import type { Rule } from 'eslint';
import type { BlockStatement, CallExpression, Expression, Node, Statement } from 'estree';
import { isGlobalObject } from '../utils/dom-lookups';
import {
  getIndentUnit,
  getLineIndentation,
  walkSubtree,
  type NodeWithParent,
} from '../utils/lifecycle';

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

function containsCustomElementsGet(node: Node): boolean {
  return walkSubtree(node, (n) => {
    if (n.type === 'CallExpression' && isCustomElementsMethod(n, 'get')) {
      return true;
    }
  });
}

function statementAlwaysExits(stmt: Statement): boolean {
  switch (stmt.type) {
    case 'ReturnStatement':
    case 'ThrowStatement':
    case 'ContinueStatement':
    case 'BreakStatement':
      return true;
    case 'BlockStatement':
      return stmt.body.some((s) => statementAlwaysExits(s));
    default:
      return false;
  }
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

function isDefineGuarded(callNode: CallExpression & { parent?: NodeWithParent }): boolean {
  let current: NodeWithParent | undefined = callNode;
  while (current?.parent) {
    const parent: NodeWithParent = current.parent;

    if (parent.type === 'IfStatement') {
      if (containsCustomElementsGet(parent.test)) return true;
    }

    if (parent.type === 'TryStatement' && parent.block === current) {
      return true;
    }

    if (parent.type === 'LogicalExpression' && parent.right === current) {
      if (containsCustomElementsGet(parent.left)) return true;
    }

    if (parent.type === 'ConditionalExpression' && parent.test !== current) {
      if (containsCustomElementsGet(parent.test)) return true;
    }

    if (parent.type === 'BlockStatement') {
      const block = parent as BlockStatement;
      const idx = block.body.indexOf(current as Statement);
      for (let i = idx - 1; i >= 0; i--) {
        const prev = block.body[i];
        if (
          prev.type === 'IfStatement' &&
          statementAlwaysExits(prev.consequent) &&
          containsCustomElementsGet(prev.test)
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
        const call = node as CallExpression & { parent?: NodeWithParent };
        if (isDefineGuarded(call)) return;

        const tagArg = node.arguments[0];
        if (!tagArg || tagArg.type === 'SpreadElement') return;

        const tagText = sourceCode.getText(tagArg);
        const parent = call.parent;
        const canFix =
          parent?.type === 'ExpressionStatement' &&
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
                const indentedBody = stmtText
                  .split('\n')
                  .map((line, i) =>
                    i === 0 ? `${indent}${unit}${line}` : line ? `${unit}${line}` : line,
                  )
                  .join('\n');
                return fixer.replaceText(
                  stmt,
                  `if (!${registryText}.get(${tagText})) {\n${indentedBody}\n${indent}}`,
                );
              }
            : undefined,
        });
      },
    };
  },
};

export default rule;
