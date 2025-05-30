import { path, recursiveReadDirectory } from '@shopify/theme-check-common';
import { ModuleItem, Pattern, Statement } from '@swc/core';
import { Dependencies } from '.';

/**
 * Regular expression for web component names
 *
 * Based on the HTML specification for valid custom element names.
 *
 * https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
 */
const wcre =
  /^[a-z][-.\d_a-z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*([-][-.\d_a-z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*)$/u;

/** e.g. product-element, */
export type WebComponentName = string;
export type WebComponentDefinition = {
  assetName: string; // Relative path to the asset file
  range: [number, number]; // Start and end positions in the file
};
export type WebComponentMap = Map<WebComponentName, WebComponentDefinition>;

/**
 * Find all the web component definitions from the JavaScript files in the
 * assets directory.
 *
 * From those, we'll be able to map `<custom-element-name>` to the definition in
 * the corresponding asset file.
 */
export async function getWebComponentMap(
  rootUri: string,
  { fs, getSourceCode }: Dependencies,
): Promise<WebComponentMap> {
  const webComponentDefs = new Map<string, { assetName: string; range: [number, number] }>();
  const assetRoot = path.join(rootUri, 'assets');
  const jsFiles = await recursiveReadDirectory(fs, assetRoot, ([fileName]) =>
    fileName.endsWith('.js'),
  );

  const promises = jsFiles.map(async (jsFile) => {
    const sourceCode = await getSourceCode(jsFile);
    if (sourceCode.type !== 'javascript') {
      return;
    }

    const ast = sourceCode.ast;
    if (ast instanceof Error) {
      return;
    }

    for (const node of ast.body) {
      visit(node, (item, ancestors) => {
        if ('type' in item && item.type === 'StringLiteral' && wcre.test(item.value)) {
          // Making sure we're looking at customElements.define calls
          const parentNode = ancestors.at(-1);
          if (!parentNode) return;
          if (parentNode.type !== 'CallExpression') return;
          const callee = parentNode.callee;
          if (callee.type !== 'MemberExpression') return;
          const property = callee.property;
          if (property.type !== 'Identifier') return;
          if (property.value !== 'define') return;

          webComponentDefs.set(item.value, {
            assetName: path.relative(jsFile, assetRoot),
            range: [property.span.start, node.span.end],
          });
        }
        return null;
      });
    }
  });

  await Promise.all(promises);

  return webComponentDefs;
}

type SWCNode = ModuleItem | Statement | Pattern;

function visit(
  item: SWCNode,
  visitor: (item: SWCNode, ancestors: SWCNode[]) => void,
  ancestors: SWCNode[] = [],
): void {
  if (!item || typeof item !== 'object') return;
  visitor(item, ancestors);

  const ancestry = [...ancestors, item];
  for (const [_key, value] of Object.entries(item)) {
    if (Array.isArray(value)) {
      value.forEach((child) => {
        if (typeof child === 'object') {
          if ('type' in child) {
            visit(child, visitor, ancestry);
          } else if ('expression' in child && 'type' in child.expression) {
            visit(child.expression, visitor, ancestry);
          }
        }
      });
    } else if (value && typeof value === 'object' && 'type' in value) {
      visit(value as ModuleItem | Statement, visitor, ancestry);
    }
  }
}
