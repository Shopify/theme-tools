import {
  recursiveReadDirectory as findAllFiles,
  path,
  SectionSchema,
  UriString,
} from '@shopify/theme-check-common';
import { IDependencies, ThemeGraph } from '../types';
import { augmentDependencies } from './augment';
import { getSectionModule, getTemplateModule } from './module';
import { traverseModule } from './traverse';

export async function buildThemeGraph(
  rootUri: UriString,
  ideps: IDependencies,
): Promise<ThemeGraph> {
  const deps = augmentDependencies(rootUri, ideps);

  const [templates, sectionSchemas] = await Promise.all([
    findAllFiles(deps.fs, rootUri, ([uri]) => uri.startsWith(path.join(rootUri, 'templates'))),
    findAllFiles(
      deps.fs,
      rootUri,
      ([uri]) => uri.startsWith(path.join(rootUri, 'sections')) && uri.endsWith('.liquid'),
    ).then((sections) =>
      Promise.all(
        sections.map((sectionUri) => deps.getSectionSchema(path.basename(sectionUri, '.liquid'))),
      ),
    ),
  ]);

  const themeGraph: ThemeGraph = {
    entryPoints: [],
    modules: {},
    rootUri,
  };

  themeGraph.entryPoints = [
    // Templates are entry points for the theme graph.
    ...templates.map((entryUri) => getTemplateModule(themeGraph, entryUri)),
    // Section Types can be used as IDs in the section rendering API.
    // We can't reliably determine which sections are used by the Section Rendering API
    // so we're forced to accept all sections as entry points.
    ...sectionSchemas
      .filter((schema): schema is SectionSchema => !!schema)
      .map((schema) => getSectionModule(themeGraph, schema.name)),
  ];

  await Promise.all(themeGraph.entryPoints.map((entry) => traverseModule(entry, themeGraph, deps)));

  return themeGraph;
}
