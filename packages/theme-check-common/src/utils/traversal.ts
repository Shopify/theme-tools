import { Reference } from '../types';
import { isSnippet } from '../to-schema';

/** BFS upward through direct references to find all ancestor URIs. */
export async function getAncestorUris(
  uri: string,
  getReferences: (uri: string) => Promise<Reference[]>,
): Promise<string[]> {
  const ancestors: string[] = [];
  const visited = new Set<string>();
  const queue = [uri];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const refs = await getReferences(current);
    for (const ref of refs) {
      if (ref.type === 'direct' && !visited.has(ref.source.uri)) {
        ancestors.push(ref.source.uri);
        queue.push(ref.source.uri);
      }
    }
  }

  return ancestors;
}

/**
 * BFS through direct dependencies to find all snippet descendant URIs
 * (including the initial snippet URIs themselves).
 */
export async function getAllSnippetDescendantUris(
  initialUris: string[],
  getDependencies: (uri: string) => Promise<Reference[]>,
): Promise<string[]> {
  const result: string[] = [];
  const visited = new Set<string>();
  const queue = [...initialUris];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    result.push(current);

    const deps = await getDependencies(current);
    for (const dep of deps) {
      if (dep.type === 'direct' && isSnippet(dep.target.uri) && !visited.has(dep.target.uri)) {
        queue.push(dep.target.uri);
      }
    }
  }

  return result;
}

/**
 * Get all direct snippet dependency URIs from a file.
 */
export async function getRenderedSnippetUris(
  uri: string,
  getDependencies: (uri: string) => Promise<Reference[]>,
): Promise<string[]> {
  const deps = await getDependencies(uri);
  return deps
    .filter((dep) => dep.type === 'direct' && isSnippet(dep.target.uri))
    .map((dep) => dep.target.uri);
}
