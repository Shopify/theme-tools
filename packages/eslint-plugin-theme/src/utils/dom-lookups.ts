import type { CallExpression, Expression, MemberExpression, Super } from 'estree';

export type OutsideLookupKind = 'document' | 'closest';

export interface OutsideLookupOptions {
  checkClosest?: boolean;
}

const DOCUMENT_LOOKUP_METHODS = new Set([
  'querySelector',
  'querySelectorAll',
  'getElementById',
  'getElementsByClassName',
  'getElementsByTagName',
  'getElementsByTagNameNS',
  'getElementsByName',
]);

const ELEMENT_LOOKUP_METHODS = new Set([
  'querySelector',
  'querySelectorAll',
  'getElementsByClassName',
  'getElementsByTagName',
  'getElementsByTagNameNS',
  'closest',
]);

const DOCUMENT_ROOT_ELEMENTS = new Set(['body', 'documentElement', 'head']);

function isGlobalObject(node: Expression | Super): boolean {
  return node.type === 'Identifier' && (node.name === 'window' || node.name === 'globalThis');
}

function unwrapChain(node: Expression): Expression {
  return node.type === 'ChainExpression' ? node.expression : node;
}

export function isDocumentObject(node: Expression | Super): boolean {
  if (node.type === 'ChainExpression') {
    return isDocumentObject(node.expression);
  }
  if (node.type === 'Identifier' && node.name === 'document') {
    return true;
  }
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === 'document' &&
    isGlobalObject(node.object)
  ) {
    return true;
  }
  return false;
}

function isDocumentRootElement(node: Expression | Super): boolean {
  if (node.type === 'ChainExpression') {
    return isDocumentRootElement(node.expression);
  }
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    DOCUMENT_ROOT_ELEMENTS.has(node.property.name) &&
    isDocumentObject(node.object)
  );
}

function isArrayFromCall(node: CallExpression): boolean {
  return (
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'Array' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'from'
  );
}

function isCollectionIndexing(node: MemberExpression): boolean {
  if (!node.computed) return false;
  // String-literal computed keys like `el['id']` read a property rather than indexing a list.
  if (node.property.type === 'Literal' && typeof node.property.value === 'string') {
    return false;
  }
  return true;
}

function mergeLookupKinds(
  a: OutsideLookupKind | null,
  b: OutsideLookupKind | null,
): OutsideLookupKind | null {
  if (a === 'document' || b === 'document') return 'document';
  return a ?? b;
}

/**
 * Classifies whether an expression produces a DOM element (or collection of elements)
 * obtained from a document-wide lookup or `this.closest(...)`.
 *
 * Returns `'document'`, `'closest'`, or `null`.
 */
export function classifyOutsideLookup(
  expr: Expression,
  options: OutsideLookupOptions = {},
): OutsideLookupKind | null {
  const node = unwrapChain(expr);

  switch (node.type) {
    case 'CallExpression': {
      if (isArrayFromCall(node)) {
        const firstArg = node.arguments[0];
        if (firstArg && firstArg.type !== 'SpreadElement') {
          return classifyOutsideLookup(firstArg, options);
        }
        return null;
      }

      if (
        node.callee.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.property.type === 'Identifier'
      ) {
        const methodName = node.callee.property.name;
        const receiver = node.callee.object;

        if (DOCUMENT_LOOKUP_METHODS.has(methodName) && isDocumentObject(receiver)) {
          return 'document';
        }

        if (ELEMENT_LOOKUP_METHODS.has(methodName) && isDocumentRootElement(receiver)) {
          return 'document';
        }

        if (
          options.checkClosest &&
          methodName === 'closest' &&
          receiver.type === 'ThisExpression'
        ) {
          return 'closest';
        }

        if (
          receiver.type !== 'Super' &&
          (ELEMENT_LOOKUP_METHODS.has(methodName) || methodName === 'item')
        ) {
          return classifyOutsideLookup(receiver, options);
        }
      }

      return null;
    }

    case 'LogicalExpression': {
      if (node.operator === '||' || node.operator === '??') {
        return mergeLookupKinds(
          classifyOutsideLookup(node.left, options),
          classifyOutsideLookup(node.right, options),
        );
      }
      if (node.operator === '&&') {
        return classifyOutsideLookup(node.right, options);
      }
      return null;
    }

    case 'ConditionalExpression': {
      return mergeLookupKinds(
        classifyOutsideLookup(node.consequent, options),
        classifyOutsideLookup(node.alternate, options),
      );
    }

    case 'ArrayExpression': {
      let kind: OutsideLookupKind | null = null;
      for (const element of node.elements) {
        if (element?.type === 'SpreadElement') {
          kind = mergeLookupKinds(kind, classifyOutsideLookup(element.argument, options));
        }
      }
      return kind;
    }

    case 'MemberExpression': {
      if (node.object.type !== 'Super' && isCollectionIndexing(node)) {
        return classifyOutsideLookup(node.object, options);
      }
      return null;
    }

    default:
      return null;
  }
}
