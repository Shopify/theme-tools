import {
  LiquidRawTag,
  HtmlElement,
  HtmlRawNode,
  HtmlVoidElement,
  HtmlSelfClosingElement,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { AbstractFileSystem } from '../../AbstractFileSystem';
import { recursiveReadDirectory } from '../../context-utils';
import {
  extractCSSClassNames,
  collectUsedClasses,
  collectUsedClassesFromSvg,
} from '../../utils/styles';
import {
  getAncestorUris,
  getAllSnippetDescendantUris,
  getRenderedSnippetUris,
} from '../../utils/traversal';

/** Collect CSS classes from all .css files in the assets directory via getCSSClassesForURI. */
async function getAssetCSSClasses(
  fs: AbstractFileSystem,
  toUri: (relativePath: string) => string,
  getCSSClassesForURI: (uri: string) => Promise<Set<string>>,
): Promise<Set<string>> {
  const classes = new Set<string>();
  try {
    const assetsUri = toUri('assets');
    const files = await fs.readDirectory(assetsUri);
    const cssFileUris = files.filter(([uri]) => uri.endsWith('.css')).map(([uri]) => uri);
    const results = await Promise.all(cssFileUris.map((uri) => getCSSClassesForURI(uri)));
    for (const fileClasses of results) {
      for (const cls of fileClasses) classes.add(cls);
    }
  } catch {
    // assets directory might not exist
  }
  return classes;
}

/** Collect ALL CSS classes defined anywhere in the theme via getCSSClassesForURI. */
async function getAllThemeCSSClasses(
  fs: AbstractFileSystem,
  toUri: (relativePath: string) => string,
  getCSSClassesForURI: (uri: string) => Promise<Set<string>>,
): Promise<Set<string>> {
  const allClasses = new Set<string>();

  // Collect from CSS asset files
  const assetClasses = await getAssetCSSClasses(fs, toUri, getCSSClassesForURI);
  for (const cls of assetClasses) allClasses.add(cls);

  // Collect from all liquid files' stylesheet tags
  try {
    const rootUri = toUri('');
    const liquidFiles = await recursiveReadDirectory(fs, rootUri, ([uri]) =>
      uri.endsWith('.liquid'),
    );
    const results = await Promise.all(liquidFiles.map((uri) => getCSSClassesForURI(uri)));
    for (const classes of results) {
      for (const cls of classes) allClasses.add(cls);
    }
  } catch {
    // root directory read failure
  }

  return allClasses;
}

export const ValidScopedCSSClass: LiquidCheckDefinition = {
  meta: {
    code: 'ValidScopedCSSClass',
    name: 'Validates CSS classes used in class attributes are defined in an in-scope stylesheet',
    docs: {
      description:
        'Reports CSS classes used in HTML class attributes that are not defined in any in-scope stylesheet tag or CSS asset file.',
      recommended: false,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-scoped-css-class',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const localCSSClasses = new Set<string>();
    const usedClasses: { className: string; startIndex: number; endIndex: number }[] = [];

    return {
      async LiquidRawTag(node: LiquidRawTag) {
        if (node.name === 'stylesheet') {
          for (const cls of extractCSSClassNames(node.body.value)) {
            localCSSClasses.add(cls);
          }
        }
      },

      async HtmlElement(node: HtmlElement) {
        collectUsedClasses(node.attributes, usedClasses);
      },

      async HtmlVoidElement(node: HtmlVoidElement) {
        collectUsedClasses(node.attributes, usedClasses);
      },

      async HtmlSelfClosingElement(node: HtmlSelfClosingElement) {
        collectUsedClasses(node.attributes, usedClasses);
      },

      async HtmlRawNode(node: HtmlRawNode) {
        if (node.name === 'svg') {
          collectUsedClassesFromSvg(
            node.attributes,
            node.body.value,
            node.body.position.start,
            usedClasses,
          );
        }
      },

      async onCodePathEnd() {
        if (usedClasses.length === 0) return;

        const { getReferences, getDependencies, getCSSClassesForURI, fs, toUri } = context;
        if (!getReferences || !getDependencies || !getCSSClassesForURI) return;

        // Start with local CSS classes
        const inScopeClasses = new Set(localCSSClasses);

        // 1. Extract CSS classes from all .css files in the assets folder
        const assetClasses = await getAssetCSSClasses(fs, toUri, getCSSClassesForURI);
        for (const cls of assetClasses) {
          inScopeClasses.add(cls);
        }

        // 2. Get all ancestors (following direct references upward)
        const ancestors = await getAncestorUris(context.file.uri, getReferences);

        // 3. Extract CSS classes from ancestor stylesheet tags
        const ancestorClassResults = await Promise.all(
          ancestors.map((uri) => getCSSClassesForURI(uri)),
        );
        for (const classes of ancestorClassResults) {
          for (const cls of classes) inScopeClasses.add(cls);
        }

        // 4. Collect rendered snippets from this file and all ancestors
        const filesToCheck = [context.file.uri, ...ancestors];
        const allRenderedSnippetUris: string[] = [];
        for (const fileUri of filesToCheck) {
          const snippetUris = await getRenderedSnippetUris(fileUri, getDependencies);
          allRenderedSnippetUris.push(...snippetUris);
        }

        // 5. BFS through snippet descendants to find all reachable snippets
        const allSnippetUris = await getAllSnippetDescendantUris(
          allRenderedSnippetUris,
          getDependencies,
        );

        // 6. Extract CSS classes from all reachable snippet stylesheet tags
        const snippetClassResults = await Promise.all(
          allSnippetUris.map((uri) => getCSSClassesForURI(uri)),
        );
        for (const classes of snippetClassResults) {
          for (const cls of classes) inScopeClasses.add(cls);
        }

        // 7. Collect ALL CSS classes defined anywhere in the theme
        const allThemeClasses = await getAllThemeCSSClasses(fs, toUri, getCSSClassesForURI);

        // 8. Only report classes that ARE defined somewhere in the theme but not in scope.
        //    Classes not defined anywhere (e.g. from CDNs, utility frameworks) are silently ignored.
        for (const { className, startIndex, endIndex } of usedClasses) {
          if (allThemeClasses.has(className) && !inScopeClasses.has(className)) {
            context.report({
              message: `CSS class '${className}' may be defined outside the scope of this file.`,
              startIndex,
              endIndex,
            });
          }
        }
      },
    };
  },
};
