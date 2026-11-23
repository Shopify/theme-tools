import type { Rule } from 'eslint';
import type { AssignmentExpression, CallExpression, MemberExpression, Node, Program } from 'estree';
import {
  collectCustomElements,
  type ClassNode,
  type CustomElementInfo,
} from '../utils/custom-elements';
import { isPageStateElement } from '../utils/dom-lookups';
import {
  buildDisconnectedCallbackFix,
  collectReachableMethods,
  walkSubtree,
} from '../utils/lifecycle';

interface RuleOptions {
  checkCustomProperties?: boolean;
}

interface PageCleanupInfo {
  removedClasses: Set<string>;
  hasDynamicClassRemove: boolean;
  removedAttrs: Set<string>;
  hasDynamicAttrRemove: boolean;
  clearedStyleProps: Set<string>;
  hasAnyStyleClear: boolean;
}

function getStaticString(node: Node | undefined): string | null {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? null;
  }
  return null;
}

function isEmptyOrNullish(node: Node): boolean {
  if (node.type === 'Literal') {
    return node.value === '' || node.value === null;
  }
  return node.type === 'Identifier' && node.name === 'undefined';
}

function getPageTargetLabel(node: Node): 'document.body' | 'document.documentElement' {
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === 'documentElement'
  ) {
    return 'document.documentElement';
  }
  return 'document.body';
}

function collectDisconnectedPageCleanups(classNode: ClassNode): PageCleanupInfo {
  const info: PageCleanupInfo = {
    removedClasses: new Set(),
    hasDynamicClassRemove: false,
    removedAttrs: new Set(),
    hasDynamicAttrRemove: false,
    clearedStyleProps: new Set(),
    hasAnyStyleClear: false,
  };

  const reachable = collectReachableMethods(classNode, 'disconnectedCallback');
  for (const method of reachable) {
    walkSubtree(method.value.body, (node) => {
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        !node.callee.computed
      ) {
        const propName =
          node.callee.property.type === 'Identifier' ? node.callee.property.name : null;

        // `document.body.classList.remove(...)` or `.toggle('foo', false)`
        if (
          (propName === 'remove' || propName === 'toggle') &&
          node.callee.object.type === 'MemberExpression' &&
          !node.callee.object.computed &&
          node.callee.object.property.type === 'Identifier' &&
          node.callee.object.property.name === 'classList' &&
          isPageStateElement(node.callee.object.object)
        ) {
          if (propName === 'toggle') {
            const secondArg = node.arguments[1];
            if (secondArg && secondArg.type === 'Literal' && secondArg.value === true) return;
          }
          const args = propName === 'toggle' ? node.arguments.slice(0, 1) : node.arguments;
          for (const arg of args) {
            const name = getStaticString(arg);
            if (name) info.removedClasses.add(name);
            else info.hasDynamicClassRemove = true;
          }
          return;
        }

        // `document.body.removeAttribute('...')`
        if (propName === 'removeAttribute' && isPageStateElement(node.callee.object)) {
          const name = getStaticString(node.arguments[0]);
          if (name) info.removedAttrs.add(name);
          else info.hasDynamicAttrRemove = true;
          return;
        }

        // `document.documentElement.style.removeProperty('--foo')`
        if (
          propName === 'removeProperty' &&
          node.callee.object.type === 'MemberExpression' &&
          !node.callee.object.computed &&
          node.callee.object.property.type === 'Identifier' &&
          node.callee.object.property.name === 'style' &&
          isPageStateElement(node.callee.object.object)
        ) {
          info.hasAnyStyleClear = true;
          const name = getStaticString(node.arguments[0]);
          if (name) info.clearedStyleProps.add(name);
        }
      }

      // `document.body.style.overflow = ''`
      if (
        node.type === 'AssignmentExpression' &&
        node.operator === '=' &&
        node.left.type === 'MemberExpression' &&
        !node.left.computed &&
        node.left.property.type === 'Identifier' &&
        node.left.object.type === 'MemberExpression' &&
        !node.left.object.computed &&
        node.left.object.property.type === 'Identifier' &&
        node.left.object.property.name === 'style' &&
        isPageStateElement(node.left.object.object) &&
        isEmptyOrNullish(node.right)
      ) {
        info.hasAnyStyleClear = true;
        info.clearedStyleProps.add(node.left.property.name);
      }
    });
  }

  return info;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description:
        'Require cleaning up document.body and document.documentElement state mutations in disconnectedCallback()',
      recommended: true,
      url: 'https://github.com/Shopify/theme-tools/blob/main/packages/eslint-plugin-theme/docs/rules/require-page-state-cleanup.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          checkCustomProperties: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      uncleanedPageState:
        '{{mutation}} inside {{element}} is not undone in disconnectedCallback(). ' +
        'If this element is removed or replaced while active (for example while a drawer or modal is open), ' +
        'page-level state such as scroll locks stays stuck until a full reload. ' +
        'Clean it up in `disconnectedCallback()`.',
      suggestCleanup: "Undo page state with '{{cleanup}}' in disconnectedCallback().",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const options: RuleOptions = context.options[0] ?? {};
    const checkCustomProperties = options.checkCustomProperties ?? false;
    const customElements = collectCustomElements(sourceCode.ast as Program);

    interface ClassState {
      classNode: ClassNode;
      info: CustomElementInfo | null;
      cleanup: PageCleanupInfo | null;
    }

    const classStack: ClassState[] = [];
    const inInstanceMethodStack: boolean[] = [];

    return {
      ClassDeclaration(node) {
        const info = customElements.get(node) ?? null;
        classStack.push({
          classNode: node,
          info,
          cleanup: info ? collectDisconnectedPageCleanups(node) : null,
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
          cleanup: info ? collectDisconnectedPageCleanups(node) : null,
        });
      },
      'ClassExpression:exit'() {
        classStack.pop();
      },

      MethodDefinition(node) {
        const cls = classStack[classStack.length - 1];
        inInstanceMethodStack.push(Boolean(cls?.info && !node.static));
      },
      'MethodDefinition:exit'() {
        inInstanceMethodStack.pop();
      },

      CallExpression(node) {
        const cls = classStack[classStack.length - 1];
        const inInstance = inInstanceMethodStack[inInstanceMethodStack.length - 1];
        if (!cls?.info || !cls.cleanup || !inInstance) return;

        if (node.callee.type !== 'MemberExpression' || node.callee.computed) return;
        const propName =
          node.callee.property.type === 'Identifier' ? node.callee.property.name : null;
        if (!propName) return;

        // 1. `document.body.classList.add(...)` / `.toggle(...)`
        if (
          (propName === 'add' || propName === 'toggle') &&
          node.callee.object.type === 'MemberExpression' &&
          !node.callee.object.computed &&
          node.callee.object.property.type === 'Identifier' &&
          node.callee.object.property.name === 'classList' &&
          isPageStateElement(node.callee.object.object)
        ) {
          if (propName === 'toggle') {
            const secondArg = node.arguments[1];
            if (secondArg && secondArg.type === 'Literal' && secondArg.value === false) return;
          }

          const targetLabel = getPageTargetLabel(node.callee.object.object);
          const classArgs = propName === 'toggle' ? node.arguments.slice(0, 1) : node.arguments;
          const staticClasses: string[] = [];
          let allStatic = classArgs.length > 0;

          for (const arg of classArgs) {
            const name = getStaticString(arg);
            if (name) {
              staticClasses.push(name);
            } else {
              allStatic = false;
            }
          }

          if (allStatic) {
            if (staticClasses.every((c) => cls.cleanup!.removedClasses.has(c))) return;
            if (cls.cleanup.hasDynamicClassRemove) return;
          } else {
            if (cls.cleanup.hasDynamicClassRemove || cls.cleanup.removedClasses.size > 0) return;
          }

          const cleanupStmt = allStatic
            ? `${targetLabel}.classList.remove(${staticClasses.map((c) => `'${c}'`).join(', ')});`
            : null;

          context.report({
            node,
            messageId: 'uncleanedPageState',
            data: {
              mutation: sourceCode.getText(node),
              element: cls.info.elementLabel,
            },
            suggest: cleanupStmt
              ? [
                  {
                    messageId: 'suggestCleanup',
                    data: { cleanup: cleanupStmt },
                    fix: (fixer) =>
                      buildDisconnectedCallbackFix(fixer, cls.classNode, [cleanupStmt], sourceCode),
                  },
                ]
              : undefined,
          });
          return;
        }

        // 2. `document.body.setAttribute(name, val)`
        if (propName === 'setAttribute' && isPageStateElement(node.callee.object)) {
          const attrName = getStaticString(node.arguments[0]);
          if (attrName && cls.cleanup.removedAttrs.has(attrName)) return;
          if (cls.cleanup.hasDynamicAttrRemove) return;
          if (!attrName && cls.cleanup.removedAttrs.size > 0) return;

          const targetLabel = getPageTargetLabel(node.callee.object);
          const cleanupStmt = attrName ? `${targetLabel}.removeAttribute('${attrName}');` : null;

          context.report({
            node,
            messageId: 'uncleanedPageState',
            data: {
              mutation: sourceCode.getText(node),
              element: cls.info.elementLabel,
            },
            suggest: cleanupStmt
              ? [
                  {
                    messageId: 'suggestCleanup',
                    data: { cleanup: cleanupStmt },
                    fix: (fixer) =>
                      buildDisconnectedCallbackFix(fixer, cls.classNode, [cleanupStmt], sourceCode),
                  },
                ]
              : undefined,
          });
          return;
        }

        // 3. `document.documentElement.style.setProperty(name, val)`
        if (
          propName === 'setProperty' &&
          node.callee.object.type === 'MemberExpression' &&
          !node.callee.object.computed &&
          node.callee.object.property.type === 'Identifier' &&
          node.callee.object.property.name === 'style' &&
          isPageStateElement(node.callee.object.object)
        ) {
          const styleProp = getStaticString(node.arguments[0]);
          // CSS custom properties (`--header-height`, etc.) are usually shared layout metrics
          // overwritten by replacement elements; skip by default to avoid noise.
          if (!checkCustomProperties && (!styleProp || styleProp.startsWith('--'))) {
            return;
          }
          if (node.arguments[1] && isEmptyOrNullish(node.arguments[1])) return;
          if (styleProp && cls.cleanup.clearedStyleProps.has(styleProp)) return;
          if (!styleProp && cls.cleanup.hasAnyStyleClear) return;

          const targetLabel = getPageTargetLabel(node.callee.object.object);
          const cleanupStmt = styleProp
            ? `${targetLabel}.style.removeProperty('${styleProp}');`
            : null;

          context.report({
            node,
            messageId: 'uncleanedPageState',
            data: {
              mutation: sourceCode.getText(node),
              element: cls.info.elementLabel,
            },
            suggest: cleanupStmt
              ? [
                  {
                    messageId: 'suggestCleanup',
                    data: { cleanup: cleanupStmt },
                    fix: (fixer) =>
                      buildDisconnectedCallbackFix(fixer, cls.classNode, [cleanupStmt], sourceCode),
                  },
                ]
              : undefined,
          });
        }
      },

      // 4. `document.body.style.overflow = 'hidden'`
      AssignmentExpression(node: AssignmentExpression) {
        const cls = classStack[classStack.length - 1];
        const inInstance = inInstanceMethodStack[inInstanceMethodStack.length - 1];
        if (!cls?.info || !cls.cleanup || !inInstance) return;

        if (node.operator !== '=' || isEmptyOrNullish(node.right)) return;
        if (node.left.type !== 'MemberExpression' || node.left.computed) return;
        if (node.left.property.type !== 'Identifier') return;

        const styleObj = node.left.object;
        if (
          styleObj.type !== 'MemberExpression' ||
          styleObj.computed ||
          styleObj.property.type !== 'Identifier' ||
          styleObj.property.name !== 'style' ||
          !isPageStateElement(styleObj.object)
        ) {
          return;
        }

        const styleProp = node.left.property.name;
        if (cls.cleanup.clearedStyleProps.has(styleProp)) return;

        const targetLabel = getPageTargetLabel(styleObj.object);
        const cleanupStmt = `${targetLabel}.style.${styleProp} = '';`;

        context.report({
          node,
          messageId: 'uncleanedPageState',
          data: {
            mutation: sourceCode.getText(node),
            element: cls.info.elementLabel,
          },
          suggest: [
            {
              messageId: 'suggestCleanup',
              data: { cleanup: cleanupStmt },
              fix: (fixer) =>
                buildDisconnectedCallbackFix(fixer, cls.classNode, [cleanupStmt], sourceCode),
            },
          ],
        });
      },
    };
  },
};

export default rule;
