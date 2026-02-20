import postcss from 'postcss';
import safeParser from 'postcss-safe-parser';
import selectorParser from 'postcss-selector-parser';
import { SourceCodeType, UriString, LiquidHtmlNode } from '../types';
import { visit } from '../visitor';

export type GetStylesheetForURI = (uri: UriString) => Promise<Stylesheet | undefined>;

export type Stylesheet = {
  uri: UriString;
  selectors?: CSSSelector[];
};

export type CSSSelector = {
  handle: string;
  type: CSSSelectorType;
};

export type CSSSelectorType =
  | 'class'
  | 'id'
  | 'tag'
  | 'attribute'
  | 'pseudo'
  | 'universal'
  | 'nesting'
  | 'combinator'
  | 'comment'
  | 'root'
  | 'selector'
  | 'string';

/**
 * Check if a Liquid AST contains a stylesheet tag.
 */
export function hasStylesheetTag(ast: LiquidHtmlNode): boolean {
  let foundStylesheetTag = false;
  visit<SourceCodeType.LiquidHtml, void>(ast, {
    LiquidRawTag(node) {
      if (node.name === 'stylesheet') foundStylesheetTag = true;
    },
  });
  return foundStylesheetTag;
}

/**
 * Extract all CSS selectors from {% stylesheet %} tags in a Liquid file.
 *
 * @example
 * ```liquid
 * {% stylesheet %}
 * .my_class { color: red; }
 * .my_class .my_other_class { color: blue; }
 * div.my_new_class { color: green; }
 * {% endstylesheet %}
 * ```
 *
 * Returns:
 * - my_class (class)
 * - my_other_class (class)
 * - div (tag)
 * - my_new_class (class)
 */
export function extractStylesheetSelectors(uri: UriString, ast: LiquidHtmlNode): Stylesheet {
  const cssContents: string[] = [];

  // Find all stylesheet tags and extract their CSS content
  visit<SourceCodeType.LiquidHtml, void>(ast, {
    LiquidRawTag(node) {
      if (node.name === 'stylesheet') {
        // Extract the raw CSS content from the stylesheet tag
        const cssContent = node.body.value;
        if (cssContent && typeof cssContent === 'string') {
          cssContents.push(cssContent);
        }
      }
    },
  });

  if (cssContents.length === 0) {
    return { uri };
  }

  // Parse all CSS content and extract selectors
  const selectorsMap = new Map<string, CSSSelector>();

  for (const cssContent of cssContents) {
    extractSelectorsFromCSSContent(cssContent, selectorsMap);
  }

  const selectors = Array.from(selectorsMap.values());

  if (selectors.length === 0) {
    return { uri };
  }

  return {
    uri,
    selectors,
  };
}

/**
 * Extract all CSS selectors from a CSS file content (e.g., .css files in assets folder).
 *
 * @param uri - The URI of the CSS file
 * @param cssContent - The CSS content to parse
 * @returns Stylesheet with extracted selectors
 */
export function extractStylesheetFromCSS(uri: UriString, cssContent: string): Stylesheet {
  const selectorsMap = new Map<string, CSSSelector>();
  extractSelectorsFromCSSContent(cssContent, selectorsMap);

  const selectors = Array.from(selectorsMap.values());

  if (selectors.length === 0) {
    return { uri };
  }

  return {
    uri,
    selectors,
  };
}

/**
 * Parse CSS content and extract all selectors into the provided map.
 * Uses a map to deduplicate selectors by their handle.
 */
function extractSelectorsFromCSSContent(cssContent: string, selectorsMap: Map<string, CSSSelector>): void {
  try {
    const root = postcss().process(cssContent, {
      parser: safeParser,
      from: undefined,
    }).root;

    root.walkRules((rule) => {
      // Skip @keyframes rules
      const atRule = rule.parent;
      if (atRule && 'name' in atRule && String(atRule.name).includes('keyframes')) {
        return;
      }

      try {
        selectorParser((selectors) => {
          selectors.walk((node) => {
            const selector = nodeToSelector(node);
            if (selector) {
              // Use handle + type as key to avoid duplicates
              const key = `${selector.type}:${selector.handle}`;
              if (!selectorsMap.has(key)) {
                selectorsMap.set(key, selector);
              }
            }
          });
        }).processSync(rule.selector);
      } catch {
        // Ignore selector parsing errors
      }
    });
  } catch {
    // Ignore CSS parsing errors
  }
}

/**
 * Convert a postcss-selector-parser node to a CSSSelector.
 * Returns undefined for nodes that shouldn't be included (combinators, etc.)
 */
function nodeToSelector(node: selectorParser.Node): CSSSelector | undefined {
  switch (node.type) {
    case 'class':
    case 'id':
    case 'tag':
    case 'pseudo':
      return { handle: node.value, type: node.type };
    case 'attribute':
      return { handle: node.attribute, type: 'attribute' };
    case 'universal':
      return { handle: '*', type: 'universal' };
    // Skip combinators, comments, roots, selectors, strings, nesting
    default:
      return undefined;
  }
}
