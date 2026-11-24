import type { Rule } from 'eslint';
import type {
  CallExpression,
  Expression,
  Identifier,
  MethodDefinition,
  Node,
  ObjectExpression,
  Program,
  Property,
  PropertyDefinition,
} from 'estree';
import {
  collectCustomElements,
  type ClassNode,
  type CustomElementInfo,
} from '../utils/custom-elements';
import { classifyOutsideLookup, isGlobalEventTarget, unwrapChain } from '../utils/dom-lookups';
import {
  buildDisconnectedCallbackFix,
  collectReachableMethods,
  findInstanceMethod,
  getCallableBody,
  getIndentUnit,
  getLineIndentation,
  hasSelfReparentOrOneTimeGuard,
  isDirectBuiltinSuperClass,
  walkSubtree,
  type NodeWithParent,
} from '../utils/lifecycle';

interface ListenerCleanupInfo {
  removedEventsByTarget: Map<string, Set<string | null>>;
}

function getTargetKey(node: Expression, sourceCode: Rule.RuleContext['sourceCode']): string | null {
  const expr = unwrapChain(node);
  if (expr.type === 'Identifier') return expr.name;
  if (expr.type === 'MemberExpression' && !expr.computed) {
    return sourceCode.getText(expr).replace(/\s+/g, '');
  }
  return null;
}

function getStaticEventName(arg: Node | undefined): string | null {
  if (!arg) return null;
  if (arg.type === 'Literal' && typeof arg.value === 'string') return arg.value;
  if (arg.type === 'TemplateLiteral' && arg.expressions.length === 0) {
    return arg.quasis[0]?.value.cooked ?? null;
  }
  return null;
}

function hasOnceOrSignalOption(
  optionsArg: Node | undefined,
  signalOptionVars?: Set<string>,
): boolean {
  if (!optionsArg) return false;
  if (optionsArg.type === 'Identifier' && signalOptionVars?.has(optionsArg.name)) {
    return true;
  }
  if (optionsArg.type !== 'ObjectExpression') return false;
  for (const prop of (optionsArg as ObjectExpression).properties) {
    if (prop.type !== 'Property' || prop.computed) continue;
    const key = prop.key;
    const name =
      key.type === 'Identifier' ? key.name : key.type === 'Literal' ? String(key.value) : null;
    if (name === 'signal') return true;
    if (name === 'once' && prop.value.type === 'Literal' && prop.value.value === true) {
      return true;
    }
  }
  return false;
}

/**
 * Inline functions and `.bind(...)` calls create a fresh function identity each time,
 * so a separate `removeEventListener` call can never match them (only `{ signal }` or `{ once: true }` can).
 */
function isUnremovableHandlerExpr(arg: Node | undefined): boolean {
  if (!arg) return false;
  if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
    return true;
  }
  if (
    arg.type === 'CallExpression' &&
    arg.callee.type === 'MemberExpression' &&
    !arg.callee.computed &&
    arg.callee.property.type === 'Identifier' &&
    arg.callee.property.name === 'bind'
  ) {
    return true;
  }
  return false;
}

function collectSignalOptionVars(node: Node): Set<string> {
  const vars = new Set<string>();
  walkSubtree(node, (n) => {
    if (
      n.type === 'VariableDeclarator' &&
      n.id.type === 'Identifier' &&
      n.init &&
      hasOnceOrSignalOption(n.init)
    ) {
      vars.add(n.id.name);
    }
  });
  return vars;
}

function collectDisconnectedListenerRemovals(
  classNode: ClassNode,
  sourceCode: Rule.RuleContext['sourceCode'],
): ListenerCleanupInfo {
  const removedEventsByTarget = new Map<string, Set<string | null>>();
  const reachable = collectReachableMethods(classNode, 'disconnectedCallback');

  for (const member of reachable) {
    const body = getCallableBody(member);
    if (!body) continue;
    walkSubtree(body, (node) => {
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'removeEventListener' &&
        node.callee.object.type !== 'Super'
      ) {
        const targetKey = getTargetKey(node.callee.object, sourceCode) ?? '*';
        const eventName = getStaticEventName(node.arguments[0]);
        let set = removedEventsByTarget.get(targetKey);
        if (!set) {
          set = new Set();
          removedEventsByTarget.set(targetKey, set);
        }
        set.add(eventName);
      }
    });
  }

  return { removedEventsByTarget };
}

function isCleanedUpInDisconnected(
  cleanup: ListenerCleanupInfo,
  targetKey: string | null,
  eventName: string | null,
  isGlobalTarget: boolean,
): boolean {
  if (cleanup.removedEventsByTarget.size === 0) return false;

  const checkSet = (events: Set<string | null> | undefined): boolean => {
    if (!events) return false;
    if (events.has(null)) return true;
    if (eventName === null) return events.size > 0;
    return events.has(eventName);
  };

  if (targetKey && checkSet(cleanup.removedEventsByTarget.get(targetKey))) {
    return true;
  }

  // For non-global targets (e.g. a local variable from `document.querySelector`),
  // also match `removeEventListener` called on a fresh `document.querySelector(...)` (`*`).
  if (!isGlobalTarget) {
    if (checkSet(cleanup.removedEventsByTarget.get('*'))) return true;
    if (!targetKey) {
      for (const events of cleanup.removedEventsByTarget.values()) {
        if (checkSet(events)) return true;
      }
    }
  }

  return false;
}

function isOutsideListenerTarget(target: Expression, outsideLocalVars: Set<string>): boolean {
  const expr = unwrapChain(target);
  if (isGlobalEventTarget(expr)) return true;
  if (classifyOutsideLookup(expr) !== null) return true;
  if (expr.type === 'Identifier' && outsideLocalVars.has(expr.name)) return true;
  return false;
}

function collectOutsideLocalVars(node: Node): Set<string> {
  const vars = new Set<string>();
  walkSubtree(node, (n) => {
    if (
      n.type === 'VariableDeclarator' &&
      n.id.type === 'Identifier' &&
      n.init &&
      (isGlobalEventTarget(n.init) || classifyOutsideLookup(n.init) !== null)
    ) {
      vars.add((n.id as Identifier).name);
    }
  });
  return vars;
}

function findAbortControllerInitPos(method: MethodDefinition): number | null {
  let pos: number | null = null;
  for (const stmt of method.value.body.body) {
    if (
      stmt.type === 'ExpressionStatement' &&
      stmt.expression.type === 'AssignmentExpression' &&
      stmt.expression.left.type === 'MemberExpression' &&
      !stmt.expression.left.computed &&
      stmt.expression.left.object.type === 'ThisExpression' &&
      stmt.expression.left.property.type === 'Identifier' &&
      stmt.expression.left.property.name === '_abortController' &&
      stmt.expression.right.type === 'NewExpression' &&
      stmt.expression.right.callee.type === 'Identifier' &&
      stmt.expression.right.callee.name === 'AbortController' &&
      stmt.range
    ) {
      pos = stmt.range[0];
      break;
    }
  }
  return pos;
}

/**
 * Checks whether `_abortController` is already used anywhere in the class outside our
 * standard `connectedCallback`/`disconnectedCallback` pattern (e.g. for `fetch` cancellation).
 */
function classUsesConflictingAbortController(
  classNode: ClassNode,
  connectedMethod: MethodDefinition,
): boolean {
  const disconnected = findInstanceMethod(classNode, 'disconnectedCallback');
  let conflict = false;

  for (const member of classNode.body.body) {
    if (member === connectedMethod || member === disconnected) continue;
    const found = walkSubtree(member, (n) => {
      if (
        n.type === 'MemberExpression' &&
        !n.computed &&
        n.object.type === 'ThisExpression' &&
        n.property.type === 'Identifier' &&
        n.property.name === '_abortController'
      ) {
        return true;
      }
      if (
        member.type === 'PropertyDefinition' &&
        !member.static &&
        !member.computed &&
        member.key.type === 'Identifier' &&
        member.key.name === '_abortController'
      ) {
        return true;
      }
    });
    if (found) {
      conflict = true;
      break;
    }
  }

  return conflict;
}

function disconnectedAbortsController(classNode: ClassNode): boolean {
  const reachable = collectReachableMethods(classNode, 'disconnectedCallback');
  for (const member of reachable) {
    const body = getCallableBody(member);
    if (!body) continue;
    const found = walkSubtree(body, (n) => {
      if (
        n.type === 'CallExpression' &&
        n.callee.type === 'MemberExpression' &&
        !n.callee.computed &&
        n.callee.property.type === 'Identifier' &&
        n.callee.property.name === 'abort'
      ) {
        const obj = unwrapChain(n.callee.object as Expression);
        if (
          obj.type === 'MemberExpression' &&
          !obj.computed &&
          obj.object.type === 'ThisExpression' &&
          obj.property.type === 'Identifier' &&
          obj.property.name === '_abortController'
        ) {
          return true;
        }
      }
    });
    if (found) return true;
  }
  return false;
}

function canSafelyAddSignalOption(call: CallExpression): boolean {
  if (call.arguments.length < 2 || call.arguments.length > 3) return false;
  if (call.arguments.some((a) => a.type === 'SpreadElement')) return false;
  if (call.arguments.length === 2) return true;

  const third = call.arguments[2];
  if (third.type === 'Literal' && typeof third.value === 'boolean') return true;
  if (third.type === 'ObjectExpression') {
    return !third.properties.some((p) => p.type === 'SpreadElement');
  }
  return false;
}

function buildSignalArgFix(
  fixer: Rule.RuleFixer,
  call: CallExpression,
  sourceCode: Rule.RuleContext['sourceCode'],
): Rule.Fix | null {
  const signalProp = 'signal: this._abortController.signal';

  if (call.arguments.length === 2) {
    return fixer.insertTextAfter(call.arguments[1], `, { ${signalProp} }`);
  }

  const third = call.arguments[2];
  if (third.type === 'Literal' && typeof third.value === 'boolean') {
    const replacement = third.value ? `{ capture: true, ${signalProp} }` : `{ ${signalProp} }`;
    return fixer.replaceText(third, replacement);
  }

  if (third.type === 'ObjectExpression') {
    if (third.properties.length === 0) {
      return fixer.replaceText(third, `{ ${signalProp} }`);
    }
    const lastProp = third.properties[third.properties.length - 1] as Property;
    const textAfterLast = sourceCode.text.slice(lastProp.range![1], third.range![1]);
    const hasTrailingComma = textAfterLast.trimStart().startsWith(',');
    if (hasTrailingComma) {
      const commaIdx = lastProp.range![1] + textAfterLast.indexOf(',') + 1;
      return fixer.insertTextAfterRange([commaIdx, commaIdx], ` ${signalProp}`);
    }
    return fixer.insertTextAfter(lastProp, `, ${signalProp}`);
  }

  return null;
}

function buildConnectedInitFix(
  fixer: Rule.RuleFixer,
  connectedMethod: MethodDefinition,
  sourceCode: Rule.RuleContext['sourceCode'],
): Rule.Fix | null {
  const body = connectedMethod.value.body;
  const openBrace = sourceCode.getFirstToken(body);
  if (!openBrace) return null;

  const methodIndent = getLineIndentation(connectedMethod, sourceCode);
  const bodyIndent =
    body.body.length > 0
      ? getLineIndentation(body.body[0], sourceCode)
      : methodIndent + getIndentUnit(methodIndent);

  // If the first statement is `super.connectedCallback();` or `super.connectedCallback?.();`,
  // insert right after it.
  const firstStmt = body.body[0];
  if (firstStmt?.type === 'ExpressionStatement') {
    const expr = unwrapChain(firstStmt.expression);
    if (
      expr.type === 'CallExpression' &&
      expr.callee.type === 'MemberExpression' &&
      expr.callee.object.type === 'Super'
    ) {
      return fixer.insertTextAfter(
        firstStmt,
        `\n${bodyIndent}this._abortController?.abort();\n${bodyIndent}this._abortController = new AbortController();`,
      );
    }
  }

  return fixer.insertTextAfter(
    openBrace,
    `\n${bodyIndent}this._abortController?.abort();\n${bodyIndent}this._abortController = new AbortController();`,
  );
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'Require cleaning up global or outside-element event listeners when a custom element disconnects',
      recommended: true,
      url: 'https://github.com/Shopify/theme-tools/blob/main/packages/eslint-plugin-theme/docs/rules/require-listener-cleanup.md',
    },
    schema: [],
    messages: {
      uncleanedListener:
        "Event listener '{{event}}' on {{target}} inside {{element}} is not cleaned up in disconnectedCallback(). " +
        'If this element is removed or replaced while the page stays open, the listener leaks and runs on detached DOM. ' +
        'Pass `{ signal: this._abortController.signal }` and call `this._abortController?.abort()` in `disconnectedCallback()`, ' +
        'or call `removeEventListener` in `disconnectedCallback()`.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const customElements = collectCustomElements(sourceCode.ast as Program);

    interface ClassState {
      classNode: ClassNode;
      info: CustomElementInfo | null;
      cleanup: ListenerCleanupInfo | null;
    }

    interface ScopeEntry {
      /** Non-null when `this` is bound to the custom element instance. */
      member: MethodDefinition | PropertyDefinition | null;
      outsideVars: Set<string>;
      signalOptionVars: Set<string>;
    }

    const classStack: ClassState[] = [];
    const scopeStack: ScopeEntry[] = [];

    return {
      ClassDeclaration(node) {
        const info = customElements.get(node) ?? null;
        classStack.push({
          classNode: node,
          info,
          cleanup: info ? collectDisconnectedListenerRemovals(node, sourceCode) : null,
        });
      },
      'ClassDeclaration:exit'() {
        classStack.pop();
      },
      ClassExpression(node) {
        const info = customElements.get(node) ?? null;
        classStack.push({
          classNode: node,
          info,
          cleanup: info ? collectDisconnectedListenerRemovals(node, sourceCode) : null,
        });
      },
      'ClassExpression:exit'() {
        classStack.pop();
      },

      MethodDefinition(node) {
        const cls = classStack[classStack.length - 1];
        if (!cls?.info || node.static) {
          scopeStack.push({ member: null, outsideVars: new Set(), signalOptionVars: new Set() });
          return;
        }
        scopeStack.push({
          member: node,
          outsideVars: collectOutsideLocalVars(node.value.body),
          signalOptionVars: collectSignalOptionVars(node.value.body),
        });
      },
      'MethodDefinition:exit'() {
        scopeStack.pop();
      },

      PropertyDefinition(node) {
        const cls = classStack[classStack.length - 1];
        const body = !node.static && cls?.info ? getCallableBody(node) : null;
        if (!body) {
          scopeStack.push({ member: null, outsideVars: new Set(), signalOptionVars: new Set() });
          return;
        }
        scopeStack.push({
          member: node,
          outsideVars: collectOutsideLocalVars(body),
          signalOptionVars: collectSignalOptionVars(body),
        });
      },
      'PropertyDefinition:exit'() {
        scopeStack.pop();
      },

      // Track nested regular functions whose `this` is NOT the custom element instance
      FunctionDeclaration() {
        scopeStack.push({ member: null, outsideVars: new Set(), signalOptionVars: new Set() });
      },
      'FunctionDeclaration:exit'() {
        scopeStack.pop();
      },
      FunctionExpression(node) {
        const parent = (node as NodeWithParent).parent;
        if (
          (parent?.type === 'MethodDefinition' && parent.value === node) ||
          (parent?.type === 'PropertyDefinition' && parent.value === node)
        ) {
          return;
        }
        scopeStack.push({ member: null, outsideVars: new Set(), signalOptionVars: new Set() });
      },
      'FunctionExpression:exit'(node) {
        const parent = (node as NodeWithParent).parent;
        if (
          (parent?.type === 'MethodDefinition' && parent.value === node) ||
          (parent?.type === 'PropertyDefinition' && parent.value === node)
        ) {
          return;
        }
        scopeStack.pop();
      },

      CallExpression(node) {
        const cls = classStack[classStack.length - 1];
        const currentScope = scopeStack[scopeStack.length - 1];
        if (!cls?.info || !cls.cleanup || !currentScope?.member) return;

        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.computed ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'addEventListener' ||
          node.callee.object.type === 'Super'
        ) {
          return;
        }

        const targetExpr = node.callee.object;
        if (!isOutsideListenerTarget(targetExpr, currentScope.outsideVars)) return;
        if (hasOnceOrSignalOption(node.arguments[2], currentScope.signalOptionVars)) return;

        const targetKey = getTargetKey(targetExpr, sourceCode);
        const eventName = getStaticEventName(node.arguments[0]);
        const unremovableHandler = isUnremovableHandlerExpr(node.arguments[1]);
        const globalTarget = isGlobalEventTarget(targetExpr);

        if (
          !unremovableHandler &&
          isCleanedUpInDisconnected(cls.cleanup, targetKey, eventName, globalTarget)
        ) {
          return;
        }

        // Only autofix when ALL safety invariants hold:
        // 1. Directly inside `connectedCallback()` (so `this` is the element and reconnect re-binds).
        // 2. Direct built-in superclass (`HTMLElement`, etc.) so `this._abortController` cannot
        //    collide with a superclass's controller.
        // 3. No conflicting `_abortController` usage elsewhere in the class.
        // 4. `connectedCallback()` has no self-reparenting (`appendChild(this)`) or early-return guard.
        // 5. Each report's fix is self-contained (ESLint runs multi-pass if multiple listeners exist).
        const connectedMethod = findInstanceMethod(cls.classNode, 'connectedCallback');
        const isInConnectedCallback =
          connectedMethod !== null && currentScope.member === connectedMethod;

        let canAutofix =
          isInConnectedCallback &&
          isDirectBuiltinSuperClass(cls.classNode) &&
          !hasSelfReparentOrOneTimeGuard(connectedMethod) &&
          !classUsesConflictingAbortController(cls.classNode, connectedMethod) &&
          canSafelyAddSignalOption(node);

        let needsInit = false;
        let needsAbort = false;
        if (canAutofix && connectedMethod) {
          const existingInitPos = findAbortControllerInitPos(connectedMethod);
          if (existingInitPos !== null) {
            // If `_abortController` is initialized *after* this listener, do not emit broken code.
            if (!node.range || existingInitPos > node.range[0]) {
              canAutofix = false;
            }
          } else {
            needsInit = true;
          }
          needsAbort = !disconnectedAbortsController(cls.classNode);
        }

        const targetDisplay = sourceCode.getText(targetExpr);
        const eventDisplay = eventName ?? sourceCode.getText(node.arguments[0]);

        let fix: Rule.ReportFixer | undefined;
        if (canAutofix && connectedMethod) {
          fix = (fixer) => {
            const fixes: Rule.Fix[] = [];
            const signalFix = buildSignalArgFix(fixer, node, sourceCode);
            if (!signalFix) return null;
            fixes.push(signalFix);

            if (needsInit) {
              const initFix = buildConnectedInitFix(fixer, connectedMethod, sourceCode);
              if (!initFix) return null;
              fixes.push(initFix);
            }

            if (needsAbort) {
              const discFix = buildDisconnectedCallbackFix(
                fixer,
                cls.classNode,
                ['this._abortController?.abort();'],
                sourceCode,
              );
              if (!discFix) return null;
              fixes.push(discFix);
            }

            return fixes;
          };
        }

        context.report({
          node,
          messageId: 'uncleanedListener',
          data: {
            event: eventDisplay,
            target: targetDisplay,
            element: cls.info.elementLabel,
          },
          fix,
        });
      },
    };
  },
};

export default rule;
