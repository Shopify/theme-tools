import type { Rule } from 'eslint';
import type { MethodDefinition, Node } from 'estree';
import type { ClassNode } from './custom-elements';

export type NodeWithParent = Node & { parent?: NodeWithParent };

export function walkSubtree(node: Node, visit: (n: Node) => boolean | void): boolean {
  if (visit(node) === true) return true;
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
          if (walkSubtree(item as Node, visit)) return true;
        }
      }
    } else if (value && typeof value === 'object' && typeof (value as Node).type === 'string') {
      if (walkSubtree(value as Node, visit)) return true;
    }
  }
  return false;
}

export function getInstanceMethodMap(classNode: ClassNode): Map<string, MethodDefinition> {
  const methods = new Map<string, MethodDefinition>();
  for (const member of classNode.body.body) {
    if (
      member.type === 'MethodDefinition' &&
      !member.static &&
      !member.computed &&
      member.key.type === 'Identifier'
    ) {
      methods.set(member.key.name, member);
    }
  }
  return methods;
}

export function findInstanceMethod(classNode: ClassNode, name: string): MethodDefinition | null {
  return getInstanceMethodMap(classNode).get(name) ?? null;
}

/**
 * Returns the target lifecycle method plus any same-class instance methods it calls
 * via `this.<method>()` (recursively within the class, cycle-safe).
 */
export function collectReachableMethods(
  classNode: ClassNode,
  startMethodName: string,
): MethodDefinition[] {
  const methods = getInstanceMethodMap(classNode);
  const start = methods.get(startMethodName);
  if (!start) return [];

  const visited = new Set<string>([startMethodName]);
  const queue: MethodDefinition[] = [start];
  const result: MethodDefinition[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    walkSubtree(current.value.body, (node) => {
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.object.type === 'ThisExpression' &&
        node.callee.property.type === 'Identifier'
      ) {
        const calleeName = node.callee.property.name;
        if (!visited.has(calleeName)) {
          const target = methods.get(calleeName);
          if (target) {
            visited.add(calleeName);
            queue.push(target);
          }
        }
      }
    });
  }

  return result;
}

export function getLineIndentation(node: Node, sourceCode: Rule.RuleContext['sourceCode']): string {
  const line = sourceCode.lines[(node.loc?.start.line ?? 1) - 1] ?? '';
  const match = /^(\s*)/.exec(line);
  return match ? match[1] : '';
}

export function getIndentUnit(indent: string): string {
  return indent.startsWith('\t') ? '\t' : '  ';
}

/**
 * Produces a `Rule.Fix` that appends one or more statements to `disconnectedCallback()`
 * (creating the method right after `connectedCallback()` or at the end of the class if absent).
 */
export function buildDisconnectedCallbackFix(
  fixer: Rule.RuleFixer,
  classNode: ClassNode,
  statements: string[],
  sourceCode: Rule.RuleContext['sourceCode'],
): Rule.Fix | null {
  const disconnected = findInstanceMethod(classNode, 'disconnectedCallback');

  if (disconnected) {
    const body = disconnected.value.body;
    const closingBrace = sourceCode.getLastToken(body);
    if (!closingBrace) return null;

    const methodIndent = getLineIndentation(disconnected, sourceCode);
    const bodyIndent =
      body.body.length > 0
        ? getLineIndentation(body.body[0], sourceCode)
        : methodIndent + getIndentUnit(methodIndent);

    // Handle single-line `disconnectedCallback() {}`
    if (body.loc && body.loc.start.line === body.loc.end.line) {
      if (body.body.length === 0) {
        const lines = statements.map((s) => `${bodyIndent}${s}`).join('\n');
        return fixer.replaceText(body, `{\n${lines}\n${methodIndent}}`);
      }
      const prevToken = sourceCode.getTokenBefore(closingBrace);
      if (prevToken) {
        const needsSemi =
          prevToken.value !== ';' && prevToken.value !== '}' && prevToken.value !== '{';
        return fixer.insertTextAfter(prevToken, `${needsSemi ? ';' : ''} ${statements.join(' ')}`);
      }
      return fixer.insertTextBefore(closingBrace, ` ${statements.join(' ')} `);
    }

    if (body.body.length > 0) {
      const lastStmt = body.body[body.body.length - 1];
      const lines = statements.map((s) => `\n${bodyIndent}${s}`).join('');
      return fixer.insertTextAfter(lastStmt, lines);
    }

    const lines = statements.map((s) => `${bodyIndent}${s}`).join('\n');
    return fixer.insertTextBeforeRange(
      [closingBrace.range[0] - methodIndent.length, closingBrace.range[0] - methodIndent.length],
      `${lines}\n`,
    );
  }

  const firstMember = classNode.body.body[0];
  const classIndent = getLineIndentation(classNode, sourceCode);
  const memberIndent = firstMember
    ? getLineIndentation(firstMember, sourceCode)
    : classIndent + getIndentUnit(classIndent);
  const bodyIndent = memberIndent + getIndentUnit(memberIndent);
  const bodyLines = statements.map((s) => `${bodyIndent}${s}`).join('\n');
  const methodCode = `\n\n${memberIndent}disconnectedCallback() {\n${bodyLines}\n${memberIndent}}`;

  const anchor =
    findInstanceMethod(classNode, 'connectedCallback') ??
    findInstanceMethod(classNode, 'constructor') ??
    classNode.body.body[classNode.body.body.length - 1];

  if (anchor) {
    return fixer.insertTextAfter(anchor, methodCode);
  }

  const closingBrace = sourceCode.getLastToken(classNode.body);
  if (!closingBrace) return null;
  return fixer.insertTextBefore(
    closingBrace,
    `\n${memberIndent}disconnectedCallback() {\n${bodyLines}\n${memberIndent}}\n${classIndent}`,
  );
}
