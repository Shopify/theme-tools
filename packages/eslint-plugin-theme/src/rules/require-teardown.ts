import type { Rule } from 'eslint';
import type {
  AssignmentExpression,
  CallExpression,
  MemberExpression,
  MethodDefinition,
  NewExpression,
  Node,
  Program,
} from 'estree';
import {
  collectCustomElements,
  type ClassNode,
  type CustomElementInfo,
} from '../utils/custom-elements';
import { isGlobalObject } from '../utils/dom-lookups';
import {
  buildDisconnectedCallbackFix,
  collectReachableMethods,
  getCallableBody,
  walkSubtree,
  type CallableMember,
  type NodeWithParent,
} from '../utils/lifecycle';

const OBSERVER_CLASSES = new Set(['MutationObserver', 'IntersectionObserver', 'ResizeObserver']);

interface DisconnectedTeardownInfo {
  disconnectedFields: Set<string>;
  hasAnyDisconnect: boolean;
  clearedIntervalFields: Set<string>;
  hasAnyClearInterval: boolean;
  calledUnsubFields: Set<string>;
}

function getThisPropName(node: Node): string | null {
  if (node.type === 'ChainExpression') return getThisPropName(node.expression);
  if (node.type === 'MemberExpression' && !node.computed && node.object.type === 'ThisExpression') {
    if (node.property.type === 'Identifier') return node.property.name;
    if (node.property.type === 'PrivateIdentifier') return `#${node.property.name}`;
  }
  return null;
}

function getAssignedThisProp(node: NodeWithParent): string | null {
  const parent = node.parent;
  if (
    parent?.type === 'AssignmentExpression' &&
    parent.operator === '=' &&
    parent.right === node &&
    parent.left.type === 'MemberExpression'
  ) {
    return getThisPropName(parent.left);
  }
  return null;
}

function collectDisconnectedTeardowns(classNode: ClassNode): DisconnectedTeardownInfo {
  const info: DisconnectedTeardownInfo = {
    disconnectedFields: new Set(),
    hasAnyDisconnect: false,
    clearedIntervalFields: new Set(),
    hasAnyClearInterval: false,
    calledUnsubFields: new Set(),
  };

  const reachable = collectReachableMethods(classNode, 'disconnectedCallback');
  for (const member of reachable) {
    const body = getCallableBody(member);
    if (!body) continue;
    walkSubtree(body, (node) => {
      if (node.type !== 'CallExpression') return;

      // `this.observer?.disconnect()` / `this.observer?.unobserve(...)`
      if (
        node.callee.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.property.type === 'Identifier' &&
        (node.callee.property.name === 'disconnect' || node.callee.property.name === 'unobserve')
      ) {
        info.hasAnyDisconnect = true;
        const prop = getThisPropName(node.callee.object);
        if (prop) info.disconnectedFields.add(prop);
        return;
      }

      // `clearInterval(this.timer)` or `window.clearInterval(...)`
      const isClearInterval =
        (node.callee.type === 'Identifier' && node.callee.name === 'clearInterval') ||
        (node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'clearInterval' &&
          node.callee.object.type !== 'Super' &&
          isGlobalObject(node.callee.object));

      if (isClearInterval) {
        info.hasAnyClearInterval = true;
        const firstArg = node.arguments[0];
        if (firstArg) {
          const prop = getThisPropName(firstArg);
          if (prop) info.clearedIntervalFields.add(prop);
        }
        return;
      }

      // `this.unsubscriber?.()` or `this.unsubscriber()`
      const unsubProp = getThisPropName(node.callee);
      if (unsubProp) {
        info.calledUnsubFields.add(unsubProp);
      }
    });
  }

  return info;
}

/**
 * One-shot IntersectionObservers that only observe `this` and call `observer.disconnect()`
 * or `observer.unobserve(...)` inside their own callback are common for lazy-loading and
 * are GC'd if the element is removed before intersecting.
 */
function isOneShotSelfIntersectionObserver(
  node: NewExpression & { parent?: NodeWithParent },
): boolean {
  if (node.callee.type !== 'Identifier' || node.callee.name !== 'IntersectionObserver') {
    return false;
  }
  const callback = node.arguments[0];
  if (!callback) return false;

  const selfDisconnectsInCallback = walkSubtree(callback, (n) => {
    if (
      n.type === 'CallExpression' &&
      n.callee.type === 'MemberExpression' &&
      !n.callee.computed &&
      n.callee.property.type === 'Identifier' &&
      (n.callee.property.name === 'disconnect' || n.callee.property.name === 'unobserve')
    ) {
      return true;
    }
  });
  if (!selfDisconnectsInCallback) return false;

  // Check if chained `.observe(this)` directly on `new IntersectionObserver(...)`
  const parent = node.parent;
  if (
    parent?.type === 'MemberExpression' &&
    !parent.computed &&
    parent.property.type === 'Identifier' &&
    parent.property.name === 'observe' &&
    parent.parent?.type === 'CallExpression'
  ) {
    const observeCall = parent.parent as CallExpression;
    if (observeCall.arguments.length >= 1 && observeCall.arguments[0].type === 'ThisExpression') {
      return true;
    }
  }

  // Or if stored in a local variable (not `this.<field>`), check same function observes `this`
  if (getAssignedThisProp(node) === null) {
    return true;
  }

  return false;
}

function isSetIntervalCall(node: CallExpression): boolean {
  if (node.callee.type === 'Identifier' && node.callee.name === 'setInterval') {
    return true;
  }
  if (
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'setInterval' &&
    node.callee.object.type !== 'Super' &&
    isGlobalObject(node.callee.object)
  ) {
    return true;
  }
  return false;
}

function isSubscribeCall(node: CallExpression): boolean {
  return node.callee.type === 'Identifier' && node.callee.name === 'subscribe';
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    hasSuggestions: true,
    docs: {
      description:
        'Require disconnecting observers, clearing intervals, and unsubscribing in disconnectedCallback()',
      recommended: true,
      url: 'https://github.com/Shopify/theme-tools/blob/main/packages/eslint-plugin-theme/docs/rules/require-teardown.md',
    },
    schema: [],
    messages: {
      uncleanedObserver:
        '{{observer}} created inside {{element}} is not disconnected in disconnectedCallback(). ' +
        'If this element is removed or replaced while the page stays open, the observer keeps running on detached DOM. ' +
        'Store it on `this` and call `this.<observer>?.disconnect()` in `disconnectedCallback()`.',
      uncleanedInterval:
        'setInterval() started inside {{element}} is not cleared in disconnectedCallback(). ' +
        'If this element is removed or replaced, the timer keeps firing on a detached element. ' +
        'Store the timer id on `this` and call `clearInterval(this.<timer>)` in `disconnectedCallback()`.',
      uncleanedSubscription:
        "'this.{{field}}' stores a subscribe() unsubscriber inside {{element}}, but is not called in disconnectedCallback(). " +
        'Call `this.{{field}}?.()` in `disconnectedCallback()` so removed elements stop receiving events.',
      suggestDisconnect: "Disconnect 'this.{{field}}' in disconnectedCallback().",
      suggestClearInterval: "Clear 'this.{{field}}' in disconnectedCallback().",
      suggestUnsubscribe: "Call 'this.{{field}}?.()' in disconnectedCallback().",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const customElements = collectCustomElements(sourceCode.ast as Program);

    interface ClassState {
      classNode: ClassNode;
      info: CustomElementInfo | null;
      teardown: DisconnectedTeardownInfo | null;
      connectedReachable: Set<CallableMember>;
      fixedInThisPass: boolean;
    }

    const classStack: ClassState[] = [];
    const methodStack: Array<MethodDefinition | null> = [];

    return {
      ClassDeclaration(node) {
        const info = customElements.get(node) ?? null;
        classStack.push({
          classNode: node,
          info,
          teardown: info ? collectDisconnectedTeardowns(node) : null,
          connectedReachable: info
            ? new Set(collectReachableMethods(node, 'connectedCallback'))
            : new Set(),
          fixedInThisPass: false,
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
          teardown: info ? collectDisconnectedTeardowns(node) : null,
          connectedReachable: info
            ? new Set(collectReachableMethods(node, 'connectedCallback'))
            : new Set(),
          fixedInThisPass: false,
        });
      },
      'ClassExpression:exit'() {
        classStack.pop();
      },

      MethodDefinition(node) {
        const cls = classStack[classStack.length - 1];
        methodStack.push(cls?.info && !node.static ? node : null);
      },
      'MethodDefinition:exit'() {
        methodStack.pop();
      },

      NewExpression(node) {
        const cls = classStack[classStack.length - 1];
        const currentMethod = methodStack[methodStack.length - 1];
        if (!cls?.info || !cls.teardown || !currentMethod) return;

        if (node.callee.type !== 'Identifier' || !OBSERVER_CLASSES.has(node.callee.name)) {
          return;
        }

        const newExpr = node as NewExpression & { parent?: NodeWithParent };
        if (isOneShotSelfIntersectionObserver(newExpr)) return;

        const field = getAssignedThisProp(newExpr);
        if (field) {
          if (cls.teardown.disconnectedFields.has(field)) return;
        } else {
          if (cls.teardown.hasAnyDisconnect) return;
        }

        // Only autofix when created in connectedCallback (or a method called by it) so
        // reparenting a constructor-initialized element cannot permanently kill the observer.
        const isInConnectedLifecycle = cls.connectedReachable.has(currentMethod);
        const canAutofix = Boolean(field) && isInConnectedLifecycle && !cls.fixedInThisPass;
        let fix: Rule.ReportFixer | undefined;
        let suggest: Rule.SuggestionReportDescriptor[] | undefined;

        if (field) {
          const makeFix: Rule.ReportFixer = (fixer) =>
            buildDisconnectedCallbackFix(
              fixer,
              cls.classNode,
              [`this.${field}?.disconnect();`],
              sourceCode,
            );
          if (canAutofix) {
            cls.fixedInThisPass = true;
            fix = makeFix;
          } else if (!isInConnectedLifecycle) {
            suggest = [{ messageId: 'suggestDisconnect', data: { field }, fix: makeFix }];
          }
        }

        context.report({
          node,
          messageId: 'uncleanedObserver',
          data: {
            observer: node.callee.name,
            element: cls.info.elementLabel,
          },
          fix,
          suggest,
        });
      },

      CallExpression(node) {
        const cls = classStack[classStack.length - 1];
        const currentMethod = methodStack[methodStack.length - 1];
        if (!cls?.info || !cls.teardown || !currentMethod) return;

        const call = node as CallExpression & { parent?: NodeWithParent };

        if (isSetIntervalCall(node)) {
          const field = getAssignedThisProp(call);
          if (field) {
            if (cls.teardown.clearedIntervalFields.has(field)) return;
          } else {
            if (cls.teardown.hasAnyClearInterval) return;
          }

          const isInConnectedLifecycle = cls.connectedReachable.has(currentMethod);
          const canAutofix = Boolean(field) && isInConnectedLifecycle && !cls.fixedInThisPass;
          let fix: Rule.ReportFixer | undefined;
          let suggest: Rule.SuggestionReportDescriptor[] | undefined;

          if (field) {
            const makeFix: Rule.ReportFixer = (fixer) =>
              buildDisconnectedCallbackFix(
                fixer,
                cls.classNode,
                [`clearInterval(this.${field});`],
                sourceCode,
              );
            if (canAutofix) {
              cls.fixedInThisPass = true;
              fix = makeFix;
            } else if (!isInConnectedLifecycle) {
              suggest = [{ messageId: 'suggestClearInterval', data: { field }, fix: makeFix }];
            }
          }

          context.report({
            node,
            messageId: 'uncleanedInterval',
            data: { element: cls.info.elementLabel },
            fix,
            suggest,
          });
          return;
        }

        if (isSubscribeCall(node)) {
          const field = getAssignedThisProp(call);
          if (!field) return;
          if (cls.teardown.calledUnsubFields.has(field)) return;

          context.report({
            node,
            messageId: 'uncleanedSubscription',
            data: {
              field,
              element: cls.info.elementLabel,
            },
            suggest: [
              {
                messageId: 'suggestUnsubscribe',
                data: { field },
                fix: (fixer) =>
                  buildDisconnectedCallbackFix(
                    fixer,
                    cls.classNode,
                    [`this.${field}?.();`],
                    sourceCode,
                  ),
              },
            ],
          });
        }
      },
    };
  },
};

export default rule;
