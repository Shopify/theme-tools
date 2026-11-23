import type { Rule } from 'eslint';
import type {
  BlockStatement,
  CallExpression,
  FunctionDeclaration,
  FunctionExpression,
  ArrowFunctionExpression,
  Identifier,
  IfStatement,
  Node,
  Program,
  Statement,
} from 'estree';
import {
  collectCustomElements,
  type ClassNode,
  type CustomElementInfo,
} from '../utils/custom-elements';
import { classifyOutsideLookup, isDocumentObject } from '../utils/dom-lookups';
import { walkSubtree, type NodeWithParent } from '../utils/lifecycle';

type FunctionNode = FunctionDeclaration | FunctionExpression | ArrowFunctionExpression;

const ASYNC_CALLBACK_METHODS = new Set(['then', 'catch', 'finally']);
const ASYNC_GLOBAL_CALLS = new Set(['setTimeout', 'requestAnimationFrame']);

function isAsyncCallbackFunction(fn: FunctionNode): boolean {
  if (fn.type === 'FunctionDeclaration') return false;
  const parent = (fn as NodeWithParent).parent;
  if (!parent || parent.type !== 'CallExpression') return false;
  const call = parent as CallExpression;
  if (call.callee.type === 'Identifier' && ASYNC_GLOBAL_CALLS.has(call.callee.name)) {
    return call.arguments[0] === fn;
  }
  if (
    call.callee.type === 'MemberExpression' &&
    !call.callee.computed &&
    call.callee.property.type === 'Identifier'
  ) {
    if (ASYNC_CALLBACK_METHODS.has(call.callee.property.name)) {
      return call.arguments.includes(fn);
    }
    if (
      ASYNC_GLOBAL_CALLS.has(call.callee.property.name) &&
      call.callee.object.type === 'Identifier' &&
      (call.callee.object.name === 'window' || call.callee.object.name === 'globalThis')
    ) {
      return call.arguments[0] === fn;
    }
  }
  return false;
}

function exprChecksVarConnected(expr: Node, varName: string): boolean {
  return walkSubtree(expr, (n) => {
    if (
      n.type === 'MemberExpression' &&
      !n.computed &&
      n.property.type === 'Identifier' &&
      n.property.name === 'isConnected' &&
      n.object.type === 'Identifier' &&
      n.object.name === varName
    ) {
      return true;
    }
    if (
      n.type === 'CallExpression' &&
      n.callee.type === 'MemberExpression' &&
      !n.callee.computed &&
      n.callee.property.type === 'Identifier' &&
      n.callee.property.name === 'contains' &&
      isDocumentObject(n.callee.object) &&
      n.arguments.length === 1 &&
      n.arguments[0].type === 'Identifier' &&
      n.arguments[0].name === varName
    ) {
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

function isUsageGuardedByIsConnected(
  idNode: Identifier & { parent?: NodeWithParent },
  varName: string,
): boolean {
  // Don't flag the `el.isConnected` check itself
  const directParent = idNode.parent;
  if (
    directParent?.type === 'MemberExpression' &&
    !directParent.computed &&
    directParent.object === idNode &&
    directParent.property.type === 'Identifier' &&
    directParent.property.name === 'isConnected'
  ) {
    return true;
  }

  let current: NodeWithParent | undefined = idNode;
  while (current?.parent) {
    const parent: NodeWithParent = current.parent;
    if (
      parent.type === 'FunctionDeclaration' ||
      parent.type === 'FunctionExpression' ||
      parent.type === 'ArrowFunctionExpression'
    ) {
      break;
    }

    if (parent.type === 'IfStatement') {
      const ifStmt = parent as IfStatement;
      if (ifStmt.consequent === current && exprChecksVarConnected(ifStmt.test, varName)) {
        return true;
      }
    }

    if (
      parent.type === 'LogicalExpression' &&
      parent.operator === '&&' &&
      parent.right === current
    ) {
      if (exprChecksVarConnected(parent.left, varName)) return true;
    }

    if (parent.type === 'ConditionalExpression' && parent.consequent === current) {
      if (exprChecksVarConnected(parent.test, varName)) return true;
    }

    if (parent.type === 'BlockStatement') {
      const block = parent as BlockStatement;
      const idx = block.body.indexOf(current as Statement);
      for (let i = idx - 1; i >= 0; i--) {
        const prev = block.body[i];
        if (
          prev.type === 'IfStatement' &&
          statementAlwaysExits(prev.consequent) &&
          exprChecksVarConnected(prev.test, varName)
        ) {
          return true;
        }
      }
    }

    current = parent;
  }

  return false;
}

function isDOMUsageOfIdentifier(idNode: Identifier & { parent?: NodeWithParent }): boolean {
  const parent = idNode.parent;
  if (!parent) return false;
  // Flag member accesses / method calls on the element: `drawer.renderContents(...)`, `drawer.innerHTML = ...`
  if (parent.type === 'MemberExpression' && parent.object === idNode) {
    if (
      !parent.computed &&
      parent.property.type === 'Identifier' &&
      parent.property.name === 'isConnected'
    ) {
      return false;
    }
    return true;
  }
  return false;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow using a local variable from a document-wide DOM lookup after an await, .then(), or setTimeout() without re-querying or checking isConnected',
      recommended: true,
      url: 'https://github.com/Shopify/theme-tools/blob/main/packages/eslint-plugin-theme/docs/rules/no-stale-element-after-await.md',
    },
    schema: [],
    messages: {
      staleAfterAsync:
        "'{{name}}' was looked up from the document before an async boundary inside {{element}} and may be detached by the time this runs. " +
        'Re-query the element after the async operation completes, or check `{{name}}?.isConnected` before using it.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const customElements = collectCustomElements(sourceCode.ast as Program);

    interface ClassState {
      classNode: ClassNode;
      info: CustomElementInfo | null;
    }

    const classStack: ClassState[] = [];

    function analyzeMethodBody(fn: FunctionNode, elementInfo: CustomElementInfo): void {
      if (fn.body.type !== 'BlockStatement') return;

      // Collect local variables declared in this method directly initialized from a document lookup
      interface TrackedVar {
        name: string;
        declRange: [number, number];
        reassignedAt: number[];
      }

      const tracked = new Map<string, TrackedVar>();
      const awaitPositions: number[] = [];

      // Walk the method body WITHOUT descending into nested functions to find declarations & awaits
      function scanOwnScope(node: Node): void {
        if (
          node !== fn &&
          (node.type === 'FunctionDeclaration' ||
            node.type === 'FunctionExpression' ||
            node.type === 'ArrowFunctionExpression' ||
            node.type === 'ClassDeclaration' ||
            node.type === 'ClassExpression')
        ) {
          return;
        }

        if (node.type === 'AwaitExpression' && node.range) {
          awaitPositions.push(node.range[0]);
        } else if (
          node.type === 'VariableDeclarator' &&
          node.id.type === 'Identifier' &&
          node.init &&
          node.range
        ) {
          const kind = classifyOutsideLookup(node.init);
          if (kind === 'document-single' || kind === 'document-snapshot') {
            tracked.set(node.id.name, {
              name: node.id.name,
              declRange: node.range,
              reassignedAt: [],
            });
          }
        } else if (
          node.type === 'AssignmentExpression' &&
          node.left.type === 'Identifier' &&
          node.range
        ) {
          const entry = tracked.get(node.left.name);
          if (entry) entry.reassignedAt.push(node.range[0]);
        }

        for (const key of Object.keys(node)) {
          if (
            key === 'parent' ||
            key === 'loc' ||
            key === 'range' ||
            key === 'tokens' ||
            key === 'comments'
          ) {
            continue;
          }
          const value = (node as unknown as Record<string, unknown>)[key];
          if (Array.isArray(value)) {
            for (const item of value) {
              if (item && typeof item === 'object' && typeof (item as Node).type === 'string') {
                scanOwnScope(item as Node);
              }
            }
          } else if (
            value &&
            typeof value === 'object' &&
            typeof (value as Node).type === 'string'
          ) {
            scanOwnScope(value as Node);
          }
        }
      }

      scanOwnScope(fn.body);
      if (tracked.size === 0) return;

      const reportedVars = new Set<string>();

      // Check usages: (1) in same scope after an await, (2) inside async callbacks (.then, setTimeout, rAF)
      function scanUsages(node: Node, insideAsyncCallback: boolean, shadowed: Set<string>): void {
        if (
          node !== fn &&
          (node.type === 'FunctionDeclaration' ||
            node.type === 'FunctionExpression' ||
            node.type === 'ArrowFunctionExpression')
        ) {
          const isAsyncCb = isAsyncCallbackFunction(node);
          const nextShadowed = new Set(shadowed);
          for (const param of node.params) {
            if (param.type === 'Identifier') nextShadowed.add(param.name);
          }
          // Only descend into async callbacks (not synchronous `.forEach` / `.map` callbacks)
          if (!isAsyncCb && !insideAsyncCallback) return;
          walkSubtree(node.body, (child) => {
            if (child.type === 'VariableDeclarator' && child.id.type === 'Identifier') {
              nextShadowed.add(child.id.name);
            }
          });
          scanUsages(node.body, true, nextShadowed);
          return;
        }

        if (node.type === 'Identifier' && node.range && !shadowed.has(node.name)) {
          const entry = tracked.get(node.name);
          if (entry && !reportedVars.has(node.name)) {
            const idNode = node as Identifier & { parent?: NodeWithParent };
            if (isDOMUsageOfIdentifier(idNode)) {
              const pos = node.range[0];
              const crossedAwait =
                !insideAsyncCallback &&
                awaitPositions.some(
                  (awaitPos) =>
                    awaitPos > entry.declRange[1] &&
                    awaitPos < pos &&
                    !entry.reassignedAt.some((r) => r > awaitPos && r < pos),
                );
              const crossedCallback = insideAsyncCallback && pos > entry.declRange[1];

              if (
                (crossedAwait || crossedCallback) &&
                !isUsageGuardedByIsConnected(idNode, node.name)
              ) {
                reportedVars.add(node.name);
                context.report({
                  node: idNode,
                  messageId: 'staleAfterAsync',
                  data: {
                    name: node.name,
                    element: elementInfo.elementLabel,
                  },
                });
              }
            }
          }
        }

        for (const key of Object.keys(node)) {
          if (
            key === 'parent' ||
            key === 'loc' ||
            key === 'range' ||
            key === 'tokens' ||
            key === 'comments'
          ) {
            continue;
          }
          const value = (node as unknown as Record<string, unknown>)[key];
          if (Array.isArray(value)) {
            for (const item of value) {
              if (item && typeof item === 'object' && typeof (item as Node).type === 'string') {
                scanUsages(item as Node, insideAsyncCallback, shadowed);
              }
            }
          } else if (
            value &&
            typeof value === 'object' &&
            typeof (value as Node).type === 'string'
          ) {
            scanUsages(value as Node, insideAsyncCallback, shadowed);
          }
        }
      }

      scanUsages(fn.body, false, new Set());
    }

    return {
      ClassDeclaration(node) {
        classStack.push({ classNode: node, info: customElements.get(node) ?? null });
      },
      'ClassDeclaration:exit'() {
        classStack.pop();
      },
      ClassExpression(node) {
        classStack.push({ classNode: node, info: customElements.get(node) ?? null });
      },
      'ClassExpression:exit'() {
        classStack.pop();
      },

      MethodDefinition(node) {
        const cls = classStack[classStack.length - 1];
        if (!cls?.info || node.static) return;
        analyzeMethodBody(node.value, cls.info);
      },
    };
  },
};

export default rule;
