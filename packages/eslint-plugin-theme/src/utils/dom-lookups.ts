import type { CallExpression, Expression, MemberExpression, Super } from 'estree';

export type OutsideLookupKind = 'document-single' | 'document-snapshot' | 'closest';

export interface OutsideLookupOptions {
  checkClosest?: boolean;
}

const SINGLE_ELEMENT_DOCUMENT_METHODS = new Set(['querySelector', 'getElementById']);

const SNAPSHOT_DOCUMENT_METHODS = new Set(['querySelectorAll']);

const LIVE_COLLECTION_METHODS = new Set([
  'getElementsByClassName',
  'getElementsByTagName',
  'getElementsByTagNameNS',
  'getElementsByName',
]);

const CHAINABLE_SINGLE_METHODS = new Set(['querySelector', 'closest']);
const CHAINABLE_SNAPSHOT_METHODS = new Set(['querySelectorAll']);
const DOCUMENT_ROOT_ELEMENTS = new Set(['body', 'documentElement', 'head']);
const PAGE_STATE_ELEMENTS = new Set(['body', 'documentElement']);

export function isGlobalObject(node: Expression | Super): boolean {
  return node.type === 'Identifier' && (node.name === 'window' || node.name === 'globalThis');
}

export function unwrapChain(node: Expression): Expression {
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

export function isDocumentRootElement(node: Expression | Super): boolean {
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

export function isPageStateElement(node: Expression | Super): boolean {
  if (node.type === 'ChainExpression') {
    return isPageStateElement(node.expression);
  }
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    PAGE_STATE_ELEMENTS.has(node.property.name) &&
    isDocumentObject(node.object)
  );
}

export function isGlobalEventTarget(node: Expression | Super): boolean {
  if (node.type === 'ChainExpression') {
    return isGlobalEventTarget(node.expression);
  }
  return isGlobalObject(node) || isDocumentObject(node) || isDocumentRootElement(node);
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

type InternalKind = OutsideLookupKind | 'document-live';

function mergeKinds(a: InternalKind | null, b: InternalKind | null): InternalKind | null {
  if (a === 'document-single' || b === 'document-single') return 'document-single';
  if (a === 'document-snapshot' || b === 'document-snapshot') return 'document-snapshot';
  if (a === 'closest' || b === 'closest') return 'closest';
  return a ?? b;
}

function classifyInternal(expr: Expression, options: OutsideLookupOptions): InternalKind | null {
  const node = unwrapChain(expr);

  switch (node.type) {
    case 'CallExpression': {
      if (isArrayFromCall(node)) {
        const firstArg = node.arguments[0];
        if (firstArg && firstArg.type !== 'SpreadElement') {
          const inner = classifyInternal(firstArg, options);
          if (inner === 'document-live' || inner === 'document-snapshot') {
            return 'document-snapshot';
          }
          return inner;
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

        if (isDocumentObject(receiver)) {
          if (SINGLE_ELEMENT_DOCUMENT_METHODS.has(methodName)) return 'document-single';
          if (SNAPSHOT_DOCUMENT_METHODS.has(methodName)) return 'document-snapshot';
          if (LIVE_COLLECTION_METHODS.has(methodName)) return 'document-live';
        }

        if (isDocumentRootElement(receiver)) {
          if (CHAINABLE_SINGLE_METHODS.has(methodName)) return 'document-single';
          if (CHAINABLE_SNAPSHOT_METHODS.has(methodName)) return 'document-snapshot';
          if (LIVE_COLLECTION_METHODS.has(methodName)) return 'document-live';
        }

        if (
          options.checkClosest &&
          methodName === 'closest' &&
          receiver.type === 'ThisExpression'
        ) {
          return 'closest';
        }

        if (receiver.type !== 'Super') {
          if (CHAINABLE_SINGLE_METHODS.has(methodName) || methodName === 'item') {
            const inner = classifyInternal(receiver, options);
            if (!inner) return null;
            return inner === 'closest' ? 'closest' : 'document-single';
          }
          if (CHAINABLE_SNAPSHOT_METHODS.has(methodName)) {
            const inner = classifyInternal(receiver, options);
            if (!inner) return null;
            return inner === 'closest' ? 'closest' : 'document-snapshot';
          }
          if (LIVE_COLLECTION_METHODS.has(methodName)) {
            const inner = classifyInternal(receiver, options);
            if (!inner) return null;
            return 'document-live';
          }
        }
      }

      return null;
    }

    case 'LogicalExpression': {
      if (node.operator === '||' || node.operator === '??') {
        return mergeKinds(
          classifyInternal(node.left, options),
          classifyInternal(node.right, options),
        );
      }
      if (node.operator === '&&') {
        return classifyInternal(node.right, options);
      }
      return null;
    }

    case 'ConditionalExpression': {
      return mergeKinds(
        classifyInternal(node.consequent, options),
        classifyInternal(node.alternate, options),
      );
    }

    case 'ArrayExpression': {
      let kind: InternalKind | null = null;
      for (const element of node.elements) {
        if (element?.type === 'SpreadElement') {
          const inner = classifyInternal(element.argument, options);
          if (inner === 'document-live' || inner === 'document-snapshot') {
            kind = mergeKinds(kind, 'document-snapshot');
          } else {
            kind = mergeKinds(kind, inner);
          }
        }
      }
      return kind;
    }

    case 'MemberExpression': {
      if (node.object.type !== 'Super' && isCollectionIndexing(node)) {
        const inner = classifyInternal(node.object, options);
        if (inner === 'document-live' || inner === 'document-snapshot') {
          return 'document-single';
        }
        return inner;
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Classifies whether an expression produces a DOM element or static snapshot list
 * obtained from a document-wide lookup or `this.closest(...)`.
 *
 * Live collections (`getElementsByClassName`, `getElementsByTagName`, etc.) stored
 * directly return `null` because the browser keeps them up to date automatically;
 * indexing (`[0]`) or snapshotting (`[...]` / `Array.from`) them is still flagged.
 */
export function classifyOutsideLookup(
  expr: Expression,
  options: OutsideLookupOptions = {},
): OutsideLookupKind | null {
  const kind = classifyInternal(expr, options);
  return kind === 'document-live' ? null : kind;
}
