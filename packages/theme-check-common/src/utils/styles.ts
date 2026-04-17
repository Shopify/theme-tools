import {
  NodeTypes,
  TextNode,
  LiquidRawTag,
  toLiquidHtmlAST,
  AttributeNode,
} from '@shopify/liquid-html-parser';
import safeParse from 'postcss-safe-parser';
import selectorParser from 'postcss-selector-parser';
import { SourceCodeType } from '../types';
import { AbstractFileSystem } from '../AbstractFileSystem';
import { recursiveReadDirectory } from '../context-utils';
import { isValuedHtmlAttribute, ValuedHtmlAttribute } from '../checks/utils';
import { visit } from '../visitor';

export function extractCSSClassNames(css: string): Set<string> {
  const classNames = new Set<string>();

  const root = safeParse(css);
  root.walkRules((rule: { selector: string }) => {
    try {
      const parsed = selectorParser().astSync(rule.selector);
      parsed.walk((node) => {
        if (node.type === 'class') {
          classNames.add(node.value);
        }
      });
    } catch {
      // If a selector fails to parse, skip it
    }
  });

  return classNames;
}

/** Read a Liquid file and extract CSS class names from its {% stylesheet %} tags. */
export async function extractCSSClassesFromLiquidUri(
  uri: string,
  fs: AbstractFileSystem,
): Promise<Set<string>> {
  const classes = new Set<string>();
  try {
    const source = await fs.readFile(uri);
    // Most liquid files have no {% stylesheet %} tag — skip the AST parse
    // entirely when the tag isn't present. Saves ~20ms/file on large themes.
    if (!/\{%-?\s+stylesheet/.test(source)) {
      return classes;
    }
    const ast = toLiquidHtmlAST(source);
    if (ast instanceof Error) return classes;
    const cssStrings = visit<SourceCodeType.LiquidHtml, string>(ast, {
      LiquidRawTag(node: LiquidRawTag) {
        if (node.name === 'stylesheet') {
          return node.body.value;
        }
      },
    });
    for (const css of cssStrings) {
      for (const cls of extractCSSClassNames(css)) {
        classes.add(cls);
      }
    }
  } catch {
    // File not found or parse error — skip
  }
  return classes;
}

/** Read a CSS asset file and extract class names from it. */
export async function extractCSSClassesFromAssetUri(
  uri: string,
  fs: AbstractFileSystem,
): Promise<Set<string>> {
  try {
    const source = await fs.readFile(uri);
    return extractCSSClassNames(source);
  } catch {
    return new Set();
  }
}

/** Collect all CSS class names from all .css files in the assets directory. */
export async function extractCSSClassesFromAssets(
  fs: AbstractFileSystem,
  toUri: (relativePath: string) => string,
): Promise<Set<string>> {
  const classes = new Set<string>();
  try {
    const assetsUri = toUri('assets');
    const files = await fs.readDirectory(assetsUri);
    const cssFiles = files.filter(([uri]) => uri.endsWith('.css'));
    const results = await Promise.all(
      cssFiles.map(([uri]) => extractCSSClassesFromAssetUri(uri, fs)),
    );
    for (const fileClasses of results) {
      for (const cls of fileClasses) {
        classes.add(cls);
      }
    }
  } catch {
    // assets directory might not exist
  }
  return classes;
}

/** Collect ALL CSS classes defined anywhere in the theme (all liquid stylesheet tags + CSS assets). */
export async function extractAllThemeCSSClasses(
  fs: AbstractFileSystem,
  toUri: (relativePath: string) => string,
): Promise<Set<string>> {
  const allClasses = new Set<string>();

  // Collect from CSS asset files
  const assetClasses = await extractCSSClassesFromAssets(fs, toUri);
  for (const cls of assetClasses) allClasses.add(cls);

  // Collect from all liquid files' stylesheet tags
  try {
    const rootUri = toUri('');
    const liquidFiles = await recursiveReadDirectory(fs, rootUri, ([uri]) =>
      uri.endsWith('.liquid'),
    );
    const results = await Promise.all(
      liquidFiles.map((uri) => extractCSSClassesFromLiquidUri(uri, fs)),
    );
    for (const classes of results) {
      for (const cls of classes) allClasses.add(cls);
    }
  } catch {
    // root directory read failure
  }

  return allClasses;
}

/** Case-insensitive check for the `class` attribute (HTML attributes are case-insensitive). */
function isClassAttribute(attr: ValuedHtmlAttribute): boolean {
  return (
    attr.name.length === 1 &&
    attr.name[0].type === NodeTypes.TextNode &&
    attr.name[0].value.toLowerCase() === 'class'
  );
}

/**
 * Extract used class names from an HTML element's class attribute.
 *
 * Tokens adjacent to Liquid nodes are discarded because they are fragments
 * of a dynamic class, not standalone static classes.
 * e.g. `class="btn-{{ size }} active"` → only `active` is collected,
 *      `btn-` is discarded because it's glued to `{{ size }}`.
 */
export function collectUsedClasses(
  attributes: AttributeNode[],
  usedClasses: { className: string; startIndex: number; endIndex: number }[],
): void {
  for (const attr of attributes) {
    if (!isValuedHtmlAttribute(attr) || !isClassAttribute(attr)) continue;

    const valueNodes = attr.value;
    for (let i = 0; i < valueNodes.length; i++) {
      const valueNode = valueNodes[i];
      if (valueNode.type !== NodeTypes.TextNode) continue;

      const textNode = valueNode as TextNode;
      const value = textNode.value;
      const baseOffset = textNode.position.start;

      const prevIsLiquid = i > 0 && valueNodes[i - 1].type !== NodeTypes.TextNode;
      const nextIsLiquid =
        i < valueNodes.length - 1 && valueNodes[i + 1].type !== NodeTypes.TextNode;

      const tokens: { className: string; startIndex: number; endIndex: number }[] = [];
      const regex = /\S+/g;
      let match;
      while ((match = regex.exec(value)) !== null) {
        tokens.push({
          className: match[0],
          startIndex: baseOffset + match.index,
          endIndex: baseOffset + match.index + match[0].length,
        });
      }

      if (tokens.length === 0) continue;

      // Drop first token if it touches the preceding Liquid node (no leading whitespace)
      if (prevIsLiquid && !/^\s/.test(value)) {
        tokens.shift();
      }

      // Drop last token if it touches the following Liquid node (no trailing whitespace)
      if (nextIsLiquid && !/\s$/.test(value)) {
        tokens.pop();
      }

      usedClasses.push(...tokens);
    }
  }
}

/**
 * Extract used class names from an SVG element (HtmlRawNode with name "svg").
 * Collects classes from the SVG tag's own attributes, then re-parses the body
 * to extract classes from inner elements (rect, g, circle, path, etc.).
 */
export function collectUsedClassesFromSvg(
  attributes: AttributeNode[],
  bodyValue: string,
  bodyStartOffset: number,
  usedClasses: { className: string; startIndex: number; endIndex: number }[],
): void {
  // Collect classes from the <svg> tag's own attributes
  collectUsedClasses(attributes, usedClasses);

  // Re-parse the SVG body to extract classes from inner elements
  try {
    const innerAst = toLiquidHtmlAST(bodyValue);
    if (innerAst instanceof Error) return;
    const innerClasses: { className: string; startIndex: number; endIndex: number }[] = [];
    const visitor = {
      HtmlElement(node: { attributes: AttributeNode[] }) {
        collectUsedClasses(node.attributes, innerClasses);
      },
      HtmlVoidElement(node: { attributes: AttributeNode[] }) {
        collectUsedClasses(node.attributes, innerClasses);
      },
      HtmlSelfClosingElement(node: { attributes: AttributeNode[] }) {
        collectUsedClasses(node.attributes, innerClasses);
      },
    };
    visit<SourceCodeType.LiquidHtml, void>(innerAst, visitor);
    // Adjust positions from body-relative to file-relative
    for (const cls of innerClasses) {
      usedClasses.push({
        className: cls.className,
        startIndex: cls.startIndex + bodyStartOffset,
        endIndex: cls.endIndex + bodyStartOffset,
      });
    }
  } catch {
    // If body can't be parsed, skip inner elements
  }
}
