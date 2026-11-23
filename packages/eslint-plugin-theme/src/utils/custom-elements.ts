import type {
  CallExpression,
  ClassDeclaration,
  ClassExpression,
  Expression,
  Identifier,
  Node,
  Program,
  Super,
  VariableDeclarator,
} from 'estree';

export type ClassNode = ClassDeclaration | ClassExpression;

export interface CustomElementInfo {
  /** Custom element tag name from `customElements.define('tag-name', ...)`, if found in this file. */
  tagName: string | null;
  /** Human-readable label for diagnostics: `<tag-name>`, class name, or `'this element'`. */
  elementLabel: string;
}

const BUILTIN_ELEMENT_CLASS = /^(?:HTML\w*Element|SVG\w*Element)$/;

function isGlobalObject(node: Expression | Super): boolean {
  return node.type === 'Identifier' && (node.name === 'window' || node.name === 'globalThis');
}

function getSuperClassName(superClass: Expression | null | undefined): string | null {
  if (!superClass) return null;
  if (superClass.type === 'Identifier') {
    return superClass.name;
  }
  if (
    superClass.type === 'MemberExpression' &&
    !superClass.computed &&
    superClass.property.type === 'Identifier' &&
    isGlobalObject(superClass.object)
  ) {
    return superClass.property.name;
  }
  return null;
}

/**
 * Extracts candidate base-class names from a `superClass` expression, including
 * mixin calls such as `createViewEventElement(HTMLElement)`.
 */
function getCandidateSuperClassNames(superClass: Expression | null | undefined): string[] {
  if (!superClass) return [];
  const direct = getSuperClassName(superClass);
  if (direct) return [direct];

  if (superClass.type === 'CallExpression') {
    const names: string[] = [];
    for (const arg of superClass.arguments) {
      if (arg.type !== 'SpreadElement') {
        names.push(...getCandidateSuperClassNames(arg));
      }
    }
    return names;
  }

  return [];
}

function isCustomElementsDefineCall(node: CallExpression): boolean {
  const { callee } = node;
  if (callee.type !== 'MemberExpression' || callee.computed) return false;
  if (callee.property.type !== 'Identifier' || callee.property.name !== 'define') return false;

  const obj = callee.object;
  if (obj.type === 'Identifier' && obj.name === 'customElements') {
    return true;
  }
  if (
    obj.type === 'MemberExpression' &&
    !obj.computed &&
    obj.property.type === 'Identifier' &&
    obj.property.name === 'customElements' &&
    isGlobalObject(obj.object)
  ) {
    return true;
  }
  return false;
}

function getStaticStringValue(node: Node | undefined): string | null {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? null;
  }
  return null;
}

function getClassDisplayName(
  classNode: ClassNode,
  varNameByClass: Map<ClassNode, string>,
): string | null {
  if (classNode.id) return classNode.id.name;
  return varNameByClass.get(classNode) ?? null;
}

function walkAst(
  node: Node,
  visit: (node: Node, parent: Node | null) => void,
  parent: Node | null = null,
): void {
  visit(node, parent);
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
          walkAst(item as Node, visit, node);
        }
      }
    } else if (value && typeof value === 'object' && typeof (value as Node).type === 'string') {
      walkAst(value as Node, visit, node);
    }
  }
}

/**
 * Collects all classes in a file that extend `HTMLElement` (directly, via same-file
 * inheritance, or by being registered with `customElements.define(...)` in the file).
 */
export function collectCustomElements(program: Program): Map<ClassNode, CustomElementInfo> {
  const allClasses: ClassNode[] = [];
  const classesByName = new Map<string, ClassNode[]>();
  const varNameByClass = new Map<ClassNode, string>();
  const definedNodeTags = new Map<ClassNode, string | null>();
  const definedNameTags = new Map<string, string | null>();

  const registerClassByName = (name: string, classNode: ClassNode) => {
    const existing = classesByName.get(name);
    if (existing) {
      existing.push(classNode);
    } else {
      classesByName.set(name, [classNode]);
    }
  };

  walkAst(program, (node, parent) => {
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      allClasses.push(node);
      if (node.id) {
        registerClassByName(node.id.name, node);
      }
      if (
        node.type === 'ClassExpression' &&
        parent?.type === 'VariableDeclarator' &&
        (parent as VariableDeclarator).init === node &&
        (parent as VariableDeclarator).id.type === 'Identifier'
      ) {
        const varName = ((parent as VariableDeclarator).id as Identifier).name;
        varNameByClass.set(node, varName);
        if (!node.id || node.id.name !== varName) {
          registerClassByName(varName, node);
        }
      }
    } else if (node.type === 'CallExpression' && isCustomElementsDefineCall(node)) {
      const [tagArg, ctorArg] = node.arguments;
      const tagName = getStaticStringValue(tagArg);
      if (!ctorArg) return;

      if (ctorArg.type === 'ClassExpression') {
        definedNodeTags.set(ctorArg, tagName);
      } else if (ctorArg.type === 'Identifier') {
        definedNameTags.set(ctorArg.name, tagName);
      }
    }
  });

  const isCustomElementCache = new Map<ClassNode, boolean>();

  function isCustomElementClass(classNode: ClassNode, visiting: Set<ClassNode>): boolean {
    const cached = isCustomElementCache.get(classNode);
    if (cached !== undefined) return cached;
    if (visiting.has(classNode)) return false;

    visiting.add(classNode);

    let result = false;
    if (definedNodeTags.has(classNode)) {
      result = true;
    } else {
      const ownName = getClassDisplayName(classNode, varNameByClass);
      if (ownName && definedNameTags.has(ownName)) {
        result = true;
      }
    }

    if (!result) {
      const superNames = getCandidateSuperClassNames(classNode.superClass);
      for (const superName of superNames) {
        if (BUILTIN_ELEMENT_CLASS.test(superName) || definedNameTags.has(superName)) {
          result = true;
          break;
        }
        const superClasses = classesByName.get(superName);
        if (superClasses?.some((superNode) => isCustomElementClass(superNode, visiting))) {
          result = true;
          break;
        }
      }
    }

    visiting.delete(classNode);
    isCustomElementCache.set(classNode, result);
    return result;
  }

  const result = new Map<ClassNode, CustomElementInfo>();

  for (const classNode of allClasses) {
    if (!isCustomElementClass(classNode, new Set())) continue;

    let tagName: string | null = null;
    if (definedNodeTags.has(classNode)) {
      tagName = definedNodeTags.get(classNode) ?? null;
    } else {
      const className = getClassDisplayName(classNode, varNameByClass);
      if (className && definedNameTags.has(className)) {
        tagName = definedNameTags.get(className) ?? null;
      }
    }

    const className = getClassDisplayName(classNode, varNameByClass);
    const elementLabel = tagName ? `<${tagName}>` : (className ?? 'this element');
    result.set(classNode, { tagName, elementLabel });
  }

  return result;
}
