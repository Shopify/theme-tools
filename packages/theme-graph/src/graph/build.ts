import {
  recursiveReadDirectory as findAllFiles,
  path,
  UriString,
} from '@shopify/theme-check-common';
import { IDependencies, ThemeGraph, ThemeModule } from '../types';
import { augmentDependencies } from './augment';
import { getModule } from './module';
import { traverseModule } from './traverse';

export async function buildThemeGraph(
  rootUri: UriString,
  ideps: IDependencies,
  entryPoints?: UriString[],
): Promise<ThemeGraph> {
  const deps = augmentDependencies(rootUri, ideps);

  entryPoints =
    entryPoints ??
    (await findAllFiles(deps.fs, rootUri, ([uri]) => {
      // Templates are entry points in the theme graph.
      const isTemplateFile = uri.startsWith(path.join(rootUri, 'templates'));

      // Since any section file can be rendered directly by the Section Rendering API,
      // we consider all section files as entry points.
      const isSectionFile =
        uri.startsWith(path.join(rootUri, 'sections')) && uri.endsWith('.liquid');

      return isTemplateFile || isSectionFile;
    }));

  const graph: ThemeGraph = {
    entryPoints: [],
    modules: {},
    rootUri,
  };

  graph.entryPoints = entryPoints
    .map((uri) => getModule(graph, uri))
    .filter((x): x is ThemeModule => x !== undefined);

  await Promise.all(graph.entryPoints.map((entry) => traverseModule(entry, graph, deps)));

  return graph;
}
