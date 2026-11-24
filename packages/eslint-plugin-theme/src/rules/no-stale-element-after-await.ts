import type { Rule, Scope } from 'eslint';
import type {
  ArrowFunctionExpression,
  BlockStatement,
  CallExpression,
  ForOfStatement,
  FunctionDeclaration,
  FunctionExpression,
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
import { classifyOutsideLookup, isDocumentObject, unwrapChain } from '../utils/dom-lookups';
import { statementAlwaysExits, type NodeWithParent } from '../utils/lifecycle';

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

function isDirectConnectedCheck(node: Node, varName: string): boolean {
  const expr = node.type === 'ChainExpression' ? node.expression : node;
  if (
    expr.type === 'MemberExpression' &&
    !expr.computed &&
    expr.property.type === 'Identifier' &&
    expr.property.name === 'isConnected' &&
    expr.object.type === 'Identifier' &&
    expr.object.name === varName
  ) {
    return true;
  }
  if (
    expr.type === 'CallExpression' &&
    expr.callee.type === 'MemberExpression' &&
    !expr.callee.computed &&
    expr.callee.property.type === 'Identifier' &&
    expr.callee.property.name === 'contains' &&
    isDocumentObject(expr.callee.object) &&
    expr.arguments.length === 1 &&
    expr.arguments[0].type === 'Identifier' &&
    expr.arguments[0].name === varName
  ) {
    return true;
  }
  return false;
}

/**
 * Evaluates whether `expr` proves `varName` is connected (`wantConnected = true`)
 * or disconnected (`wantConnected = false`), respecting `!`, `&&`, `||`, and `=== true/false`.
 */
function exprChecksVarConnected(expr: Node, varName: string, wantConnected: boolean): boolean {
  if (expr.type === 'ChainExpression') {
    return exprChecksVarConnected(expr.expression, varName, wantConnected);
  }

  if (isDirectConnectedCheck(expr, varName)) {
    return wantConnected;
  }

  if (expr.type === 'UnaryExpression' && expr.operator === '!') {
    return exprChecksVarConnected(expr.argument, varName, !wantConnected);
  }

  if (expr.type === 'BinaryExpression') {
    const isBool = (n: Node, val: boolean) => n.type === 'Literal' && n.value === val;
    if (isDirectConnectedCheck(expr.left, varName)) {
      if (isBool(expr.right, true)) {
        return expr.operator === '===' || expr.operator === '==' ? wantConnected : !wantConnected;
      }
      if (isBool(expr.right, false)) {
        return expr.operator === '===' || expr.operator === '==' ? !wantConnected : wantConnected;
      }
    }
    if (isDirectConnectedCheck(expr.right, varName)) {
      if (isBool(expr.left, true)) {
        return expr.operator === '===' || expr.operator === '==' ? wantConnected : !wantConnected;
      }
      if (isBool(expr.left, false)) {
        return expr.operator === '===' || expr.operator === '==' ? !wantConnected : wantConnected;
      }
    }
  }

  if (expr.type === 'LogicalExpression') {
    if (expr.operator === '&&') {
      if (wantConnected) {
        return (
          exprChecksVarConnected(expr.left, varName, true) ||
          exprChecksVarConnected(expr.right, varName, true)
        );
      }
      return (
        exprChecksVarConnected(expr.left, varName, false) &&
        exprChecksVarConnected(expr.right, varName, false)
      );
    }
    if (expr.operator === '||') {
      if (!wantConnected) {
        return (
          exprChecksVarConnected(expr.left, varName, false) ||
          exprChecksVarConnected(expr.right, varName, false)
        );
      }
      return (
        exprChecksVarConnected(expr.left, varName, true) &&
        exprChecksVarConnected(expr.right, varName, true)
      );
    }
  }

  return false;
}

function isUsageGuardedByIsConnected(
  idNode: Identifier & { parent?: NodeWithParent },
  varName: string,
): boolean {
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
      if (ifStmt.consequent === current && exprChecksVarConnected(ifStmt.test, varName, true)) {
        return true;
      }
      if (ifStmt.alternate === current && exprChecksVarConnected(ifStmt.test, varName, false)) {
        return true;
      }
    }

    if (
      parent.type === 'LogicalExpression' &&
      parent.operator === '&&' &&
      parent.right === current
    ) {
      if (exprChecksVarConnected(parent.left, varName, true)) return true;
    }

    if (parent.type === 'ConditionalExpression') {
      if (parent.consequent === current && exprChecksVarConnected(parent.test, varName, true)) {
        return true;
      }
      if (parent.alternate === current && exprChecksVarConnected(parent.test, varName, false)) {
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
          exprChecksVarConnected(prev.test, varName, false)
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

function isDescendantOf(child: NodeWithParent, ancestor: Node): boolean {
  let cur: NodeWithParent | undefined = child;
  while (cur) {
    if (cur === ancestor) return true;
    cur = cur.parent;
  }
  return false;
}

/**
 * Checks whether an `await` node (`AwaitExpression` or `for await`) can actually execute
 * before `usageNode` in control flow:
 * - Returns `false` if `usageNode` is inside the `await`'s own operand (`await drawer.open()`).
 * - Returns `false` if `awaitNode` and `usageNode` live in mutually exclusive `if`/`else`
 *   branches, or if `awaitNode` is inside an earlier `if` branch that always exits (`return`/`throw`).
 */
function awaitPrecedesUsage(awaitNode: NodeWithParent, usageNode: NodeWithParent): boolean {
  if (!awaitNode.range || !usageNode.range) return false;
  if (awaitNode.range[0] >= usageNode.range[0]) return false;

  // `await drawer.open()` / `await fetch(drawer.dataset.url)` evaluates operand synchronously BEFORE suspending
  if (awaitNode.type === 'AwaitExpression' && isDescendantOf(usageNode, awaitNode.argument)) {
    return false;
  }
  if (
    awaitNode.type === 'ForOfStatement' &&
    isDescendantOf(usageNode, (awaitNode as ForOfStatement).right)
  ) {
    return false;
  }

  // Build ancestor chain of `usageNode`
  const usageAncestors = new Set<Node>();
  let u: NodeWithParent | undefined = usageNode;
  while (u) {
    usageAncestors.add(u);
    u = u.parent;
  }

  // Walk up from `awaitNode` to the lowest common ancestor with `usageNode`
  let child: NodeWithParent = awaitNode;
  let parent: NodeWithParent | undefined = awaitNode.parent;
  while (parent && !usageAncestors.has(parent)) {
    // If `awaitNode` is inside a branch that always exits (`if (!el) { await ...; return; }`),
    // execution cannot fall through to `usageNode` outside that branch.
    if (
      parent.type === 'IfStatement' &&
      parent.consequent === child &&
      statementAlwaysExits(parent.consequent)
    ) {
      return false;
    }
    if (
      parent.type === 'IfStatement' &&
      parent.alternate === child &&
      parent.alternate &&
      statementAlwaysExits(parent.alternate)
    ) {
      return false;
    }
    child = parent;
    parent = parent.parent;
  }

  // If the lowest common ancestor is an `IfStatement` or `ConditionalExpression` and `awaitNode`
  // is in `consequent` while `usageNode` is in `alternate` (or vice versa), they are mutually exclusive.
  if (parent && (parent.type === 'IfStatement' || parent.type === 'ConditionalExpression')) {
    const inConsequent = parent.consequent === child;
    const inAlternate = parent.alternate === child;
    if (inConsequent && parent.alternate && isDescendantOf(usageNode, parent.alternate)) {
      return false;
    }
    if (inAlternate && isDescendantOf(usageNode, parent.consequent)) {
      return false;
    }
  }

  return true;
}

function findEnclosingAsyncCallback(
  node: NodeWithParent,
  stopAtFn: FunctionNode,
): FunctionNode | null {
  let cur: NodeWithParent | undefined = node.parent;
  while (cur && cur !== stopAtFn) {
    if (
      (cur.type === 'FunctionExpression' || cur.type === 'ArrowFunctionExpression') &&
      isAsyncCallbackFunction(cur)
    ) {
      return cur;
    }
    cur = cur.parent;
  }
  return null;
}

function collectVariablesInScopeTree(
  scope: Scope.Scope,
  stopAtNestedFunctions: boolean,
): Scope.Variable[] {
  const vars: Scope.Variable[] = [...scope.variables];
  for (const child of scope.childScopes) {
    if (stopAtNestedFunctions && child.type === 'function') continue;
    vars.push(...collectVariablesInScopeTree(child, stopAtNestedFunctions));
  }
  return vars;
}

function collectAwaitsInFunction(fn: FunctionNode): NodeWithParent[] {
  const awaits: NodeWithParent[] = [];
  function visit(node: Node): void {
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
    if (node.type === 'AwaitExpression') {
      awaits.push(node as NodeWithParent);
    } else if (node.type === 'ForOfStatement' && node.await) {
      awaits.push(node as NodeWithParent);
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
            visit(item as Node);
          }
        }
      } else if (value && typeof value === 'object' && typeof (value as Node).type === 'string') {
        visit(value as Node);
      }
    }
  }
  visit(fn.body);
  return awaits;
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

    function analyzeFunction(fn: FunctionNode, elementInfo: CustomElementInfo): void {
      if (fn.body.type !== 'BlockStatement') return;

      const fnScope = sourceCode.getScope(fn);
      const vars = collectVariablesInScopeTree(fnScope, true);
      if (vars.length === 0) return;

      const awaits = collectAwaitsInFunction(fn);

      for (const variable of vars) {
        const def = variable.defs.find((d) => d.type === 'Variable');
        if (!def || def.node.type !== 'VariableDeclarator' || !def.node.init || !def.node.range) {
          continue;
        }
        const kind = classifyOutsideLookup(def.node.init);
        if (kind !== 'document-single' && kind !== 'document-snapshot') continue;

        const declEnd = def.node.range[1];
        const writePositions: number[] = [];
        for (const ref of variable.references) {
          if (ref.isWrite() && !ref.init && ref.identifier.range) {
            writePositions.push(ref.identifier.range[0]);
          }
        }

        for (const ref of variable.references) {
          if (!ref.isRead() || !ref.identifier.range) continue;
          const idNode = ref.identifier as Identifier & { parent?: NodeWithParent };
          if (!isDOMUsageOfIdentifier(idNode)) continue;

          const pos = ref.identifier.range[0];
          const asyncCb = findEnclosingAsyncCallback(idNode, fn);

          let isStale = false;
          if (asyncCb && pos > declEnd) {
            // Check if variable was reassigned inside the callback before this usage
            const cbStart = asyncCb.range?.[0] ?? 0;
            const reassignedInCb = writePositions.some((w) => w >= cbStart && w < pos);
            isStale = !reassignedInCb;
          } else if (!asyncCb && awaits.length > 0) {
            // Works for both direct usages and synchronous `.forEach`/`.map` callbacks after `await`
            isStale = awaits.some(
              (aw) =>
                aw.range &&
                aw.range[0] > declEnd &&
                awaitPrecedesUsage(aw, idNode) &&
                !writePositions.some((w) => w > aw.range![0] && w < pos),
            );
          }

          if (isStale && !isUsageGuardedByIsConnected(idNode, variable.name)) {
            context.report({
              node: idNode,
              messageId: 'staleAfterAsync',
              data: {
                name: variable.name,
                element: elementInfo.elementLabel,
              },
            });
            break; // Report once per tracked variable
          }
        }
      }
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
        analyzeFunction(node.value, cls.info);
      },

      PropertyDefinition(node) {
        const cls = classStack[classStack.length - 1];
        if (!cls?.info || node.static || !node.value) return;
        const val = unwrapChain(node.value);
        if (val.type === 'ArrowFunctionExpression' || val.type === 'FunctionExpression') {
          analyzeFunction(val, cls.info);
        }
      },
    };
  },
};

export default rule;
