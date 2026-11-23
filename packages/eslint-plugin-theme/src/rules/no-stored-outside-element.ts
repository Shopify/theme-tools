import type { Rule } from 'eslint';
import type {
  AssignmentExpression,
  BlockStatement,
  ClassBody,
  ConditionalExpression,
  Expression,
  ExpressionStatement,
  IfStatement,
  MemberExpression,
  MethodDefinition,
  Node,
  Program,
  PropertyDefinition,
  Statement,
} from 'estree';
import {
  collectCustomElements,
  type ClassNode,
  type CustomElementInfo,
} from '../utils/custom-elements';
import {
  classifyOutsideLookup,
  isDocumentObject,
  type OutsideLookupKind,
} from '../utils/dom-lookups';

type NodeWithParent = Node & { parent?: NodeWithParent };

interface RuleOptions {
  checkClosest?: boolean;
}

interface FieldTarget {
  /** Stable key for comparing two `this.<field>` accesses, e.g. `prop:cart` or `priv:#cart`. */
  key: string;
  /** Display name in the diagnostic, e.g. `this.cart` or `this.#cart`. */
  displayTarget: string;
  /** Identifier used in the getter example, e.g. `cart` or `#cart`. */
  getterName: string;
  /** Whether a safe getter rewrite is syntactically possible for this field name. */
  canSuggestGetter: boolean;
}

interface ThisContext {
  classNode: ClassNode | null;
  customElement: CustomElementInfo | null;
  /** Non-null when directly inside `constructor()` or `connectedCallback()` of a custom element. */
  setupMethod: MethodDefinition | null;
}

const VALID_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function getThisFieldTarget(
  member: MemberExpression,
  sourceCode: Rule.RuleContext['sourceCode'],
): FieldTarget | null {
  if (member.object.type !== 'ThisExpression') return null;

  if (!member.computed && member.property.type === 'Identifier') {
    const name = member.property.name;
    return {
      key: `prop:${name}`,
      displayTarget: `this.${name}`,
      getterName: name,
      canSuggestGetter: true,
    };
  }

  if (!member.computed && member.property.type === 'PrivateIdentifier') {
    const name = member.property.name;
    return {
      key: `priv:#${name}`,
      displayTarget: `this.#${name}`,
      getterName: `#${name}`,
      canSuggestGetter: true,
    };
  }

  if (
    member.computed &&
    member.property.type === 'Literal' &&
    typeof member.property.value === 'string'
  ) {
    const name = member.property.value;
    const validId = VALID_IDENTIFIER.test(name);
    return {
      key: `prop:${name}`,
      displayTarget: sourceCode.getText(member),
      getterName: validId ? name : 'element',
      canSuggestGetter: false,
    };
  }

  return {
    key: `expr:${sourceCode.getText(member)}`,
    displayTarget: sourceCode.getText(member),
    getterName: 'element',
    canSuggestGetter: false,
  };
}

function getPropertyDefinitionTarget(
  prop: PropertyDefinition,
  sourceCode: Rule.RuleContext['sourceCode'],
): FieldTarget | null {
  if (prop.static) return null;

  if (!prop.computed && prop.key.type === 'Identifier') {
    const name = prop.key.name;
    return {
      key: `prop:${name}`,
      displayTarget: `this.${name}`,
      getterName: name,
      canSuggestGetter: true,
    };
  }

  if (!prop.computed && prop.key.type === 'PrivateIdentifier') {
    const name = prop.key.name;
    return {
      key: `priv:#${name}`,
      displayTarget: `this.#${name}`,
      getterName: `#${name}`,
      canSuggestGetter: true,
    };
  }

  return {
    key: `expr:this[${sourceCode.getText(prop.key)}]`,
    displayTarget: `this[${sourceCode.getText(prop.key)}]`,
    getterName: 'element',
    canSuggestGetter: false,
  };
}

function matchesThisField(
  expr: Node,
  fieldKey: string,
  sourceCode: Rule.RuleContext['sourceCode'],
): boolean {
  if (expr.type === 'ChainExpression') {
    return matchesThisField(expr.expression, fieldKey, sourceCode);
  }
  if (expr.type === 'MemberExpression') {
    const target = getThisFieldTarget(expr, sourceCode);
    if (target && target.key === fieldKey) return true;
  }
  return false;
}

function exprChecksConnectedness(
  node: Node,
  fieldKey: string,
  sourceCode: Rule.RuleContext['sourceCode'],
): boolean {
  if (node.type === 'ChainExpression') {
    return exprChecksConnectedness(node.expression, fieldKey, sourceCode);
  }

  // `this._cart?.isConnected` or `this._cart.isConnected`
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === 'isConnected' &&
    matchesThisField(node.object, fieldKey, sourceCode)
  ) {
    return true;
  }

  // `document.contains(this._cart)`
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'contains' &&
    isDocumentObject(node.callee.object) &&
    node.arguments.length === 1 &&
    matchesThisField(node.arguments[0], fieldKey, sourceCode)
  ) {
    return true;
  }

  if (node.type === 'UnaryExpression') {
    return exprChecksConnectedness(node.argument, fieldKey, sourceCode);
  }

  if (node.type === 'LogicalExpression' || node.type === 'BinaryExpression') {
    return (
      exprChecksConnectedness(node.left, fieldKey, sourceCode) ||
      exprChecksConnectedness(node.right, fieldKey, sourceCode)
    );
  }

  if (node.type === 'ConditionalExpression') {
    return (
      exprChecksConnectedness(node.test, fieldKey, sourceCode) ||
      exprChecksConnectedness(node.consequent, fieldKey, sourceCode) ||
      exprChecksConnectedness(node.alternate, fieldKey, sourceCode)
    );
  }

  return false;
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

function isGuardedByIsConnected(
  assignment: AssignmentExpression & { parent?: NodeWithParent },
  fieldKey: string,
  sourceCode: Rule.RuleContext['sourceCode'],
): boolean {
  // Pattern: `this._cart = this._cart?.isConnected ? this._cart : document.querySelector(...)`
  if (
    assignment.right.type === 'ConditionalExpression' &&
    exprChecksConnectedness(assignment.right.test, fieldKey, sourceCode)
  ) {
    return true;
  }

  let current: NodeWithParent | undefined = assignment;
  while (current?.parent) {
    const parent: NodeWithParent = current.parent;

    // Stop at function or class boundaries
    if (
      parent.type === 'FunctionDeclaration' ||
      parent.type === 'FunctionExpression' ||
      parent.type === 'ArrowFunctionExpression' ||
      parent.type === 'ClassDeclaration' ||
      parent.type === 'ClassExpression'
    ) {
      break;
    }

    if (parent.type === 'IfStatement') {
      const ifStmt = parent as IfStatement;
      if (
        (ifStmt.consequent === current || ifStmt.alternate === current) &&
        exprChecksConnectedness(ifStmt.test, fieldKey, sourceCode)
      ) {
        return true;
      }
    }

    if (parent.type === 'ConditionalExpression') {
      const cond = parent as ConditionalExpression;
      if (
        (cond.consequent === current || cond.alternate === current) &&
        exprChecksConnectedness(cond.test, fieldKey, sourceCode)
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
          exprChecksConnectedness(prev.test, fieldKey, sourceCode)
        ) {
          return true;
        }
      }
    }

    current = parent;
  }

  return false;
}

function walkSubtree(node: Node, visit: (n: Node) => boolean | void): boolean {
  if (visit(node) === true) return true;
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && typeof (item as Node).type === 'string') {
          if (walkSubtree(item as Node, visit)) return true;
        }
      }
    } else if (value && typeof value === 'object' && typeof (value as Node).type === 'string') {
      if (walkSubtree(value as Node, visit)) return true;
    }
  }
  return false;
}

function collectDeclaredNames(node: Node): Set<string> {
  const names = new Set<string>();

  function addPattern(pattern: Node): void {
    switch (pattern.type) {
      case 'Identifier':
        names.add(pattern.name);
        break;
      case 'AssignmentPattern':
        addPattern(pattern.left);
        break;
      case 'RestElement':
        addPattern(pattern.argument);
        break;
      case 'ArrayPattern':
        for (const el of pattern.elements) {
          if (el) addPattern(el);
        }
        break;
      case 'ObjectPattern':
        for (const prop of pattern.properties) {
          if (prop.type === 'RestElement') {
            addPattern(prop.argument);
          } else {
            addPattern(prop.value);
          }
        }
        break;
    }
  }

  walkSubtree(node, (n) => {
    if (n.type === 'VariableDeclarator') {
      addPattern(n.id);
    } else if (n.type === 'FunctionDeclaration' && n.id) {
      names.add(n.id.name);
    } else if (n.type === 'ClassDeclaration' && n.id) {
      names.add(n.id.name);
    } else if (n.type === 'CatchClause' && n.param) {
      addPattern(n.param);
    } else if (
      n.type === 'FunctionExpression' ||
      n.type === 'FunctionDeclaration' ||
      n.type === 'ArrowFunctionExpression'
    ) {
      for (const param of n.params) {
        addPattern(param);
      }
    }
  });

  return names;
}

function exprReferencesUnsafeBindings(
  expr: Expression,
  localNames: Set<string>,
  fieldKey: string,
  sourceCode: Rule.RuleContext['sourceCode'],
): boolean {
  return walkSubtree(expr, (n) => {
    if (n.type === 'Super') return true;
    if (n.type === 'Identifier' && n.name === 'arguments') return true;

    // Avoid self-referential getter recursion: `this.header = this.header || ...`
    if (n.type === 'MemberExpression' && matchesThisField(n, fieldKey, sourceCode)) {
      return true;
    }

    if (n.type === 'Identifier' && localNames.has(n.name)) {
      const parent = (n as NodeWithParent).parent;
      // Ignore non-computed property names like `obj.foo` and object literal keys `{ foo: 1 }`
      if (parent?.type === 'MemberExpression' && !parent.computed && parent.property === n) {
        return false;
      }
      if (
        parent?.type === 'Property' &&
        !parent.computed &&
        !parent.shorthand &&
        parent.key === n
      ) {
        return false;
      }
      return true;
    }
  });
}

function classHasMemberOrOtherAssignment(
  classBody: ClassBody,
  target: FieldTarget,
  ignoreNode: Node,
  sourceCode: Rule.RuleContext['sourceCode'],
): boolean {
  for (const member of classBody.body) {
    if (member === ignoreNode) continue;
    if (member.type === 'MethodDefinition' || member.type === 'PropertyDefinition') {
      if (member.static || member.computed) continue;
      if (member.key.type === 'Identifier' && `prop:${member.key.name}` === target.key) {
        return true;
      }
      if (member.key.type === 'PrivateIdentifier' && `priv:#${member.key.name}` === target.key) {
        return true;
      }
    }
  }

  return walkSubtree(classBody, (n) => {
    if (n === ignoreNode) return false;
    if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression') {
      const leftTarget = getThisFieldTarget(n.left, sourceCode);
      if (leftTarget && leftTarget.key === target.key) {
        return true;
      }
    }
    if (n.type === 'UpdateExpression' && n.argument.type === 'MemberExpression') {
      const argTarget = getThisFieldTarget(n.argument, sourceCode);
      if (argTarget && argTarget.key === target.key) {
        return true;
      }
    }
  });
}

function getLineIndentation(node: Node, sourceCode: Rule.RuleContext['sourceCode']): string {
  const line = sourceCode.lines[(node.loc?.start.line ?? 1) - 1] ?? '';
  const match = /^(\s*)/.exec(line);
  return match ? match[1] : '';
}

function getStatementRemovalRange(
  stmt: ExpressionStatement,
  sourceCode: Rule.RuleContext['sourceCode'],
): [number, number] | null {
  if (!stmt.range || !stmt.loc) return null;
  const text = sourceCode.text;
  let start = stmt.range[0];
  let end = stmt.range[1];

  // Expand backwards across leading spaces/tabs on the same line
  while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) {
    start--;
  }

  // Only remove the entire line if the statement is alone on its line
  const startsLine = start === 0 || text[start - 1] === '\n' || text[start - 1] === '\r';
  let lineEnd = end;
  while (lineEnd < text.length && (text[lineEnd] === ' ' || text[lineEnd] === '\t')) {
    lineEnd++;
  }
  const endsLine = lineEnd === text.length || text[lineEnd] === '\n' || text[lineEnd] === '\r';

  if (startsLine && endsLine) {
    if (text[lineEnd] === '\r' && text[lineEnd + 1] === '\n') {
      end = lineEnd + 2;
    } else if (text[lineEnd] === '\n' || text[lineEnd] === '\r') {
      end = lineEnd + 1;
    } else {
      end = lineEnd;
    }
    return [start, end];
  }

  return null;
}

function isSetupMethod(node: MethodDefinition): boolean {
  if (node.static) return false;
  if (node.kind === 'constructor') return true;
  return (
    node.kind === 'method' &&
    !node.computed &&
    node.key.type === 'Identifier' &&
    node.key.name === 'connectedCallback'
  );
}

function buildSetupMethodGetterSuggestion(
  assignment: AssignmentExpression & { parent?: NodeWithParent },
  target: FieldTarget,
  classNode: ClassNode,
  setupMethod: MethodDefinition,
  sourceCode: Rule.RuleContext['sourceCode'],
): Rule.SuggestionReportDescriptor[] | undefined {
  if (!target.canSuggestGetter || assignment.operator !== '=') return undefined;

  const stmt = assignment.parent;
  if (!stmt || stmt.type !== 'ExpressionStatement') return undefined;
  if (stmt.parent !== setupMethod.value.body) return undefined;
  if (sourceCode.getCommentsInside(stmt).length > 0) return undefined;

  const removalRange = getStatementRemovalRange(stmt as ExpressionStatement, sourceCode);
  if (!removalRange) return undefined;

  const methodLocals = collectDeclaredNames(setupMethod.value);
  if (exprReferencesUnsafeBindings(assignment.right, methodLocals, target.key, sourceCode)) {
    return undefined;
  }

  if (classHasMemberOrOtherAssignment(classNode.body, target, assignment, sourceCode)) {
    return undefined;
  }

  const indent = getLineIndentation(setupMethod, sourceCode);
  const innerIndent = indent + (indent.startsWith('\t') ? '\t' : '  ');
  const exprText = sourceCode.getText(assignment.right);
  const getterCode = `\n\n${indent}get ${target.getterName}() {\n${innerIndent}return ${exprText};\n${indent}}`;

  return [
    {
      messageId: 'replaceWithGetter',
      data: { target: target.displayTarget },
      fix(fixer) {
        return [fixer.removeRange(removalRange), fixer.insertTextAfter(setupMethod, getterCode)];
      },
    },
  ];
}

function buildFieldGetterSuggestion(
  prop: PropertyDefinition,
  target: FieldTarget,
  classNode: ClassNode,
  sourceCode: Rule.RuleContext['sourceCode'],
): Rule.SuggestionReportDescriptor[] | undefined {
  if (!target.canSuggestGetter || !prop.value) return undefined;
  if (sourceCode.getCommentsInside(prop).length > 0) return undefined;

  if (exprReferencesUnsafeBindings(prop.value, new Set(), target.key, sourceCode)) {
    return undefined;
  }

  if (classHasMemberOrOtherAssignment(classNode.body, target, prop, sourceCode)) {
    return undefined;
  }

  const indent = getLineIndentation(prop, sourceCode);
  const innerIndent = indent + (indent.startsWith('\t') ? '\t' : '  ');
  const exprText = sourceCode.getText(prop.value);
  const getterCode = `get ${target.getterName}() {\n${innerIndent}return ${exprText};\n${indent}}`;

  return [
    {
      messageId: 'replaceWithGetter',
      data: { target: target.displayTarget },
      fix(fixer) {
        return fixer.replaceText(prop, getterCode);
      },
    },
  ];
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description:
        'Disallow storing the result of document-wide DOM lookups on custom element instances',
      recommended: true,
      url: 'https://github.com/Shopify/theme-tools/blob/main/packages/eslint-plugin-theme/docs/rules/no-stored-outside-element.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          checkClosest: {
            type: 'boolean',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      storedOutsideElement:
        "'{{target}}' stores the result of a document-wide lookup, which may be an element outside {{element}}. " +
        'An outside element can be replaced while this one stays on the page. ' +
        'If it is outside, look it up when you use it:\n' +
        '  get {{getterName}}() { return document.querySelector(...); }\n' +
        "If it's inside this element, use this.querySelector(...) instead. " +
        'If this runs on every frame (scroll, pointermove), cache it and check isConnected before use.',
      storedOutsideList:
        "'{{target}}' stores a static snapshot from a document-wide lookup, which may include elements outside {{element}}. " +
        'Elements can be replaced or added while this one stays on the page, and checking isConnected on a snapshot misses newly added elements. ' +
        'Look them up when you use them:\n' +
        '  get {{getterName}}() { return document.querySelectorAll(...); }\n' +
        "If they're inside this element, use this.querySelectorAll(...) instead.",
      storedAncestorElement:
        "'{{target}}' stores the result of this.closest(...), which may be an ancestor outside {{element}}. " +
        'An outside element can be replaced while this one stays on the page. ' +
        'Look it up when you use it:\n' +
        '  get {{getterName}}() { return this.closest(...); }\n' +
        'If this runs on every frame (scroll, pointermove), cache it and check isConnected before use.',
      replaceWithGetter:
        "Replace '{{target}}' with a getter that looks up the element on each access.",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const options: RuleOptions = context.options[0] ?? {};
    const checkClosest = options.checkClosest ?? false;

    const customElements = collectCustomElements(sourceCode.ast as Program);

    const classStack: ClassNode[] = [];
    const thisStack: ThisContext[] = [];

    function currentThisContext(): ThisContext | null {
      return thisStack.length > 0 ? thisStack[thisStack.length - 1] : null;
    }

    function currentClass(): ClassNode | null {
      return classStack.length > 0 ? classStack[classStack.length - 1] : null;
    }

    function reportLookup(
      reportNode: Node,
      lookupKind: OutsideLookupKind,
      target: FieldTarget,
      customElement: CustomElementInfo,
      suggest?: Rule.SuggestionReportDescriptor[],
    ): void {
      const messageId =
        lookupKind === 'closest'
          ? 'storedAncestorElement'
          : lookupKind === 'document-snapshot'
            ? 'storedOutsideList'
            : 'storedOutsideElement';
      context.report({
        node: reportNode,
        messageId,
        data: {
          target: target.displayTarget,
          element: customElement.elementLabel,
          getterName: target.getterName,
        },
        suggest,
      });
    }

    return {
      ClassDeclaration(node) {
        classStack.push(node);
      },
      'ClassDeclaration:exit'() {
        classStack.pop();
      },
      ClassExpression(node) {
        classStack.push(node);
      },
      'ClassExpression:exit'() {
        classStack.pop();
      },

      MethodDefinition(node) {
        const cls = currentClass();
        const customElement = !node.static && cls ? (customElements.get(cls) ?? null) : null;
        thisStack.push({
          classNode: customElement ? cls : null,
          customElement,
          setupMethod: customElement && isSetupMethod(node) ? node : null,
        });
      },
      'MethodDefinition:exit'() {
        thisStack.pop();
      },

      PropertyDefinition(node) {
        const cls = currentClass();
        const customElement = !node.static && cls ? (customElements.get(cls) ?? null) : null;
        thisStack.push({
          classNode: customElement ? cls : null,
          customElement,
          setupMethod: null,
        });

        if (!customElement || !cls || !node.value) return;

        const lookupKind = classifyOutsideLookup(node.value, { checkClosest });
        if (!lookupKind) return;

        const target = getPropertyDefinitionTarget(node, sourceCode);
        if (!target) return;

        const suggest = buildFieldGetterSuggestion(node, target, cls, sourceCode);
        reportLookup(node.key, lookupKind, target, customElement, suggest);
      },
      'PropertyDefinition:exit'() {
        thisStack.pop();
      },

      StaticBlock() {
        thisStack.push({ classNode: null, customElement: null, setupMethod: null });
      },
      'StaticBlock:exit'() {
        thisStack.pop();
      },

      FunctionDeclaration() {
        thisStack.push({ classNode: null, customElement: null, setupMethod: null });
      },
      'FunctionDeclaration:exit'() {
        thisStack.pop();
      },

      FunctionExpression(node) {
        const parent = (node as NodeWithParent).parent;
        if (parent?.type === 'MethodDefinition' && parent.value === node) {
          return;
        }
        thisStack.push({ classNode: null, customElement: null, setupMethod: null });
      },
      'FunctionExpression:exit'(node) {
        const parent = (node as NodeWithParent).parent;
        if (parent?.type === 'MethodDefinition' && parent.value === node) {
          return;
        }
        thisStack.pop();
      },

      AssignmentExpression(node) {
        if (node.operator !== '=' && node.operator !== '||=' && node.operator !== '??=') {
          return;
        }
        if (node.left.type !== 'MemberExpression') return;

        const thisCtx = currentThisContext();
        if (!thisCtx?.customElement || !thisCtx.classNode) return;

        const target = getThisFieldTarget(node.left, sourceCode);
        if (!target) return;

        const lookupKind = classifyOutsideLookup(node.right, { checkClosest });
        if (!lookupKind) return;

        // Static snapshot lists (e.g. querySelectorAll) cannot be safely guarded by isConnected
        // because newly added elements are missed even when existing ones stay connected.
        if (
          lookupKind !== 'document-snapshot' &&
          isGuardedByIsConnected(
            node as AssignmentExpression & { parent?: NodeWithParent },
            target.key,
            sourceCode,
          )
        ) {
          return;
        }

        const suggest = thisCtx.setupMethod
          ? buildSetupMethodGetterSuggestion(
              node as AssignmentExpression & { parent?: NodeWithParent },
              target,
              thisCtx.classNode,
              thisCtx.setupMethod,
              sourceCode,
            )
          : undefined;

        reportLookup(node.left, lookupKind, target, thisCtx.customElement, suggest);
      },
    };
  },
};

export default rule;
