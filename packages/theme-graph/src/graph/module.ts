import { path, UriString } from '@shopify/theme-check-common';
import {
  CssModule,
  JavaScriptModule,
  JsonModule,
  JsonModuleKind,
  LiquidModule,
  LiquidModuleKind,
  ModuleType,
  ThemeGraph,
  ThemeModule,
} from '../types';
import { extname } from '../utils';

export function getModule(themeGraph: ThemeGraph, uri: UriString): ThemeModule | undefined {
  if (themeGraph.modules[uri]) {
    return themeGraph.modules[uri];
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
  if (themeGraph.modules[uri]) {
    return themeGraph.modules[uri];
  }

  const extension = extname(uri);
  switch (extension) {
    case 'json': {
      return {
        type: ModuleType.Json,
        kind: JsonModuleKind.Template,
        dependencies: [],
        references: [],
        uri: uri,
      };
    }

    case 'liquid': {
      return {
        type: ModuleType.Liquid,
        kind: LiquidModuleKind.Template,
        dependencies: [],
        references: [],
        uri: uri,
      };
    }

    default: {
      throw new Error(`Unknown template type for ${uri}`);
    }
  }
}

export function getThemeBlockModule(themeGraph: ThemeGraph, blockType: string): LiquidModule {
  const uri = path.join(themeGraph.rootUri, 'blocks', `${blockType}.liquid`);
  if (themeGraph.modules[uri]) {
    return themeGraph.modules[uri] as LiquidModule;
  }

  return {
    type: ModuleType.Liquid,
    kind: LiquidModuleKind.Block,
    dependencies: [],
    references: [],
    uri,
  };
}

export function getSectionModule(themeGraph: ThemeGraph, sectionType: string): LiquidModule {
  const uri = path.join(themeGraph.rootUri, 'sections', `${sectionType}.liquid`);
  if (themeGraph.modules[uri]) {
    return themeGraph.modules[uri] as LiquidModule;
  }

  return {
    type: ModuleType.Liquid,
    kind: LiquidModuleKind.Section,
    dependencies: [],
    references: [],
    uri,
  };
}

export function getSectionGroupModule(
  themeGraph: ThemeGraph,
  sectionGroupType: string,
): JsonModule {
  const uri = path.join(themeGraph.rootUri, 'sections', `${sectionGroupType}.json`);
  if (themeGraph.modules[uri]) {
    return themeGraph.modules[uri] as JsonModule;
  }

  return {
    type: ModuleType.Json,
    kind: JsonModuleKind.SectionGroup,
    dependencies: [],
    references: [],
    uri,
  };
}

export function getAssetModule(
  themeGraph: ThemeGraph,
  asset: string,
): JavaScriptModule | CssModule | undefined {
  // return undefined;
  const extension = extname(asset);
  switch (extension) {
    case 'js': {
      const uri = path.join(themeGraph.rootUri, 'assets', asset);
      if (themeGraph.modules[uri]) {
        return themeGraph.modules[uri] as JavaScriptModule;
      }

      return {
        type: ModuleType.JavaScript,
        kind: 'unused',
        dependencies: [],
        references: [],
        uri: uri,
      };
    }

    case 'css': {
      const uri = path.join(themeGraph.rootUri, 'assets', asset);
      if (themeGraph.modules[uri]) {
        return themeGraph.modules[uri] as CssModule;
      }

      return {
        type: ModuleType.Css,
        kind: 'unused',
        dependencies: [],
        references: [],
        uri: uri,
      };
    }

    default: {
      return undefined;
    }
  }
}

export function getSnippetModule(themeGraph: ThemeGraph, snippet: string): LiquidModule {
  const uri = path.join(themeGraph.rootUri, 'snippets', `${snippet}.liquid`);
  if (themeGraph.modules[uri]) {
    return themeGraph.modules[uri] as LiquidModule;
  }
  return {
    type: ModuleType.Liquid,
    kind: LiquidModuleKind.Snippet,
    uri: uri,
    dependencies: [],
    references: [],
  };
}

export function getLayoutModule(
  themeGraph: ThemeGraph,
  layoutName: string | false | undefined = 'theme',
): LiquidModule | undefined {
  if (layoutName === false) return undefined;
  if (layoutName === undefined) layoutName = 'theme';
  const uri = path.join(themeGraph.rootUri, 'layout', `${layoutName}.liquid`);
  if (themeGraph.modules[uri]) {
    return themeGraph.modules[uri] as LiquidModule;
  }

  return {
    type: ModuleType.Liquid,
    kind: LiquidModuleKind.Layout,
    uri: uri,
    dependencies: [],
    references: [],
  };
}
