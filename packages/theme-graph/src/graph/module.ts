import { path, UriString } from '@shopify/theme-check-common';
import {
  CssModule,
  ImageModule,
  JavaScriptModule,
  JsonModule,
  JsonModuleKind,
  LiquidModule,
  LiquidModuleKind,
  ModuleType,
  SUPPORTED_ASSET_IMAGE_EXTENSIONS,
  SvgModule,
  ThemeGraph,
  ThemeModule,
} from '../types';
import { extname } from '../utils';

/**
 * We're using a ModuleCache to prevent race conditions with traverse.
 *
 * e.g. if we have two modules that depend on the same 'assets/foo.js' file and
 * that they somehow depend on it before it gets traversed (and thus added to the
 * graphs' modules record), we want to avoid creating two different module objects
 * that represent the same file.
 *
 * We're using a WeakMap<ThemeGraph> to cache modules so that if the theme graph
 * gets garbage collected, the module cache will also be garbage collected.
 *
 * This allows us to have a module cache without changing the API of the
 * ThemeGraph (no need for a `visited` property on modules, etc.)
 */
const ModuleCache: WeakMap<ThemeGraph, Map<string, ThemeModule>> = new WeakMap();

export function getModule(themeGraph: ThemeGraph, uri: UriString): ThemeModule | undefined {
  const cache = getCache(themeGraph);
  if (cache.has(uri)) {
    return cache.get(uri)!;
  }

  const relativePath = path.relative(uri, themeGraph.rootUri);

  switch (true) {
    case relativePath.startsWith('assets'): {
      return getAssetModule(themeGraph, path.basename(uri));
    }

    case relativePath.startsWith('blocks'): {
      return getThemeBlockModule(themeGraph, path.basename(uri, '.liquid'));
    }

    case relativePath.startsWith('layout'): {
      return getLayoutModule(themeGraph, path.basename(uri, '.liquid'));
    }

    case relativePath.startsWith('sections'): {
      if (relativePath.endsWith('.json')) {
        return getSectionGroupModule(themeGraph, path.basename(uri, '.json'));
      }
      return getSectionModule(themeGraph, path.basename(uri, '.liquid'));
    }

    case relativePath.startsWith('snippets'): {
      return getSnippetModule(themeGraph, path.basename(uri, '.liquid'));
    }

    case relativePath.startsWith('templates'): {
      return getTemplateModule(themeGraph, uri);
    }
  }
}

export function getTemplateModule(themeGraph: ThemeGraph, uri: UriString): ThemeModule {
  const extension = extname(uri);
  switch (extension) {
    case 'json': {
      return module(themeGraph, {
        type: ModuleType.Json,
        kind: JsonModuleKind.Template,
        dependencies: [],
        references: [],
        uri: uri,
      });
    }

    case 'liquid': {
      return module(themeGraph, {
        type: ModuleType.Liquid,
        kind: LiquidModuleKind.Template,
        dependencies: [],
        references: [],
        uri: uri,
      });
    }

    default: {
      throw new Error(`Unknown template type for ${uri}`);
    }
  }
}

export function getThemeBlockModule(themeGraph: ThemeGraph, blockType: string): LiquidModule {
  const uri = path.join(themeGraph.rootUri, 'blocks', `${blockType}.liquid`);
  return module(themeGraph, {
    type: ModuleType.Liquid,
    kind: LiquidModuleKind.Block,
    dependencies: [],
    references: [],
    uri,
  });
}

export function getSectionModule(themeGraph: ThemeGraph, sectionType: string): LiquidModule {
  const uri = path.join(themeGraph.rootUri, 'sections', `${sectionType}.liquid`);
  return module(themeGraph, {
    type: ModuleType.Liquid,
    kind: LiquidModuleKind.Section,
    dependencies: [],
    references: [],
    uri,
  });
}

export function getSectionGroupModule(
  themeGraph: ThemeGraph,
  sectionGroupType: string,
): JsonModule {
  const uri = path.join(themeGraph.rootUri, 'sections', `${sectionGroupType}.json`);
  return module(themeGraph, {
    type: ModuleType.Json,
    kind: JsonModuleKind.SectionGroup,
    dependencies: [],
    references: [],
    uri,
  });
}

export function getAssetModule(
  themeGraph: ThemeGraph,
  asset: string,
): JavaScriptModule | CssModule | SvgModule | ImageModule | undefined {
  const extension = extname(asset);

  let type: ModuleType | undefined = undefined;

  if (SUPPORTED_ASSET_IMAGE_EXTENSIONS.includes(extension)) {
    type = ModuleType.Image;
  } else if (extension === 'js') {
    type = ModuleType.JavaScript;
  } else if (extension === 'css') {
    type = ModuleType.Css;
  } else if (extension === 'svg') {
    type = ModuleType.Svg;
  }

  if (!type) {
    return undefined;
  }

  return module(themeGraph, {
    type,
    kind: 'unused',
    dependencies: [],
    references: [],
    uri: path.join(themeGraph.rootUri, 'assets', asset),
  });
}

export function getSnippetModule(themeGraph: ThemeGraph, snippet: string): LiquidModule {
  const uri = path.join(themeGraph.rootUri, 'snippets', `${snippet}.liquid`);
  return module(themeGraph, {
    type: ModuleType.Liquid,
    kind: LiquidModuleKind.Snippet,
    uri: uri,
    dependencies: [],
    references: [],
  });
}

export function getLayoutModule(
  themeGraph: ThemeGraph,
  layoutName: string | false | undefined = 'theme',
): LiquidModule | undefined {
  if (layoutName === false) return undefined;
  if (layoutName === undefined) layoutName = 'theme';
  const uri = path.join(themeGraph.rootUri, 'layout', `${layoutName}.liquid`);
  return module(themeGraph, {
    type: ModuleType.Liquid,
    kind: LiquidModuleKind.Layout,
    uri: uri,
    dependencies: [],
    references: [],
  });
}

function getCache(themeGraph: ThemeGraph): Map<string, ThemeModule> {
  if (!ModuleCache.has(themeGraph)) {
    ModuleCache.set(themeGraph, new Map());
  }
  return ModuleCache.get(themeGraph)!;
}

function module<T extends ThemeModule>(themeGraph: ThemeGraph, mod: T): T {
  const cache = getCache(themeGraph);
  if (!cache.has(mod.uri)) {
    cache.set(mod.uri, mod);
  }
  return cache.get(mod.uri)! as T;
}
