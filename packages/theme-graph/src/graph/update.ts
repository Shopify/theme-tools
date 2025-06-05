import { path } from '@shopify/theme-check-common';
import {
  AugmentedDependencies,
  ChangeEvent,
  CreateEvent,
  DeleteEvent,
  IDependencies,
  JsonModule,
  JsonModuleKind,
  LiquidModule,
  LiquidModuleKind,
  ModuleType,
  Operation,
  RenameEvent,
  ThemeGraph,
  ThemeModule,
} from '../types';
import { assertNever } from '../utils';
import { augmentDependencies } from './augment';
import { buildThemeGraph } from './build';
import { getModule } from './module';
import { traverseModule } from './traverse';

/**
 * Revisits files that are invalidated in the theme graph.
 *
 * Suitable for onDidChange events and the likes
 */
export async function updateThemeGraph(
  graph: ThemeGraph,
  ideps: IDependencies,
  operations: Operation[],
): Promise<ThemeGraph> {
  if (shouldPanic(graph, operations)) {
    return buildThemeGraph(graph.rootUri, ideps);
  }

  const deps = augmentDependencies(graph.rootUri, ideps);
  for (const operation of operations) {
    switch (operation.type) {
      case 'create':
        await createModule(operation, graph, deps);
        break;
      case 'change':
        await changeModule(operation, graph, deps);
        break;
      case 'delete':
        await deleteModule(operation, graph, deps);
        break;
      case 'rename':
        await renameModule(operation, graph, deps);
        break;
      default:
        assertNever(operation);
    }
  }

  return graph;
}

async function createModule({ uri }: CreateEvent, graph: ThemeGraph, deps: AugmentedDependencies) {
  const module = getModule(graph, uri);

  // Can't traverse what doesn't exist/doesn't belong on the graph (e.g. locales files)
  if (!module) return;

  // Templates and sections are entry points
  if (isTemplate(module) || isSection(module)) {
    graph.entryPoints.push(module);
  }

  // Remove them from the visited graph so we can re-visit it (in case it was a dead link)
  delete graph.modules[uri];

  await traverseModule(module, graph, deps);
}

async function refreshModule(uri: string, graph: ThemeGraph, deps: AugmentedDependencies) {
  const module = getModule(graph, uri);
  if (!module) return; // Nothing to refresh

  // Remove from the graph so we can re-visit it
  delete graph.modules[uri];

  // Flush dependencies (we're recomputing them)
  flushDependencies(module, graph);

  await traverseModule(module, graph, deps);
}

async function changeModule({ uri }: ChangeEvent, graph: ThemeGraph, deps: AugmentedDependencies) {
  const module = getModule(graph, uri);
  if (!module) return; // Nothing to change

  // Remove from the graph so we can re-visit it
  delete graph.modules[uri];

  // Flush dependencies (content changed)
  flushDependencies(module, graph);

  // Flush references (source.range changed)
  await flushReferences(module, graph, deps);

  // Get new dependencies
  await traverseModule(module, graph, deps);
}

async function deleteModule({ uri }: DeleteEvent, graph: ThemeGraph, deps: AugmentedDependencies) {
  const module = graph.modules[uri];
  if (!module) {
    return; // Nothing to delete
  }

  if (module.references.length > 0) {
    // When other modules depend on this module, their references
    // become dead links.
    module.exists = false;
  } else {
    // When no other modules depend on this module, we can safely
    // remove it from the graph.
    delete graph.modules[uri];
  }

  flushDependencies(module, graph);
}

async function renameModule(
  { oldUri, newUri }: RenameEvent,
  graph: ThemeGraph,
  deps: AugmentedDependencies,
) {
  await deleteModule({ uri: oldUri, type: 'delete' }, graph, deps);
  await deleteModule({ uri: newUri, type: 'delete' }, graph, deps); // just in case there are dead links to the new URI
  await createModule({ uri: newUri, type: 'create' }, graph, deps);
}

const isTemplate = (
  module?: ThemeModule,
): module is JsonModule & { kind: JsonModuleKind.Template } =>
  !!module && module.type === ModuleType.Json && module.kind === JsonModuleKind.Template;

const isSection = (
  module?: ThemeModule,
): module is LiquidModule & { kind: LiquidModuleKind.Section } =>
  !!module && module.type === ModuleType.Liquid && module.kind === LiquidModuleKind.Section;

const isBlock = (module?: ThemeModule): module is LiquidModule & { kind: LiquidModuleKind.Block } =>
  !!module && module.type === ModuleType.Liquid && module.kind === LiquidModuleKind.Block;

function shouldPanic(themeGraph: ThemeGraph, operations: Operation[]): boolean {
  return operations.some((op) => {
    // Creating a new public block affects all the things that depend on '@theme'
    if (
      op.type === 'create' &&
      !path.basename(op.uri).startsWith('_') &&
      isBlock(getModule(themeGraph, op.uri))
    ) {
      return true;
    }

    return false;
  });
}

function flushDependencies(module: ThemeModule, graph: ThemeGraph): void {
  // Flush dependencies (we're recomputing them)
  const dependencies = module.dependencies.splice(0, module.dependencies.length);

  for (const { target } of dependencies) {
    // Remove the backlink from the dependency to this module
    const targetModule = graph.modules[target.uri];
    if (targetModule) {
      targetModule.references = targetModule.references.filter(
        (ref) => ref.source.uri !== module.uri,
      );
    }
  }
}

async function flushReferences(
  module: ThemeModule,
  graph: ThemeGraph,
  deps: AugmentedDependencies,
): Promise<void> {
  // Flush references (target.range might have changed)
  const references = module.references.splice(0, module.references.length);

  // Get new references
  await Promise.all(references.map(async (ref) => refreshModule(ref.source.uri, graph, deps)));
}
