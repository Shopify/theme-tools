import { path, recursiveReadDirectory } from '@shopify/theme-check-common';
import { ancestor as visit } from 'acorn-walk';
import { Dependencies, Void, WebComponentMap } from './types';
import { CallExpression } from 'acorn';

/**
 * Regular expression for web component names
 *
 * Based on the HTML specification for valid custom element names.
 *
 * https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
 */
const wcre =
  /^[a-z][-.\d_a-z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*([-][-.\d_a-z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*)$/u;

/**
 * Find all the web component definitions from the JavaScript files in the
 * assets directory.
 *
 * From those, we'll be able to map `<custom-element-name>` to the definition in
 * the corresponding asset file.
 */
export async function getWebComponentMap(
  rootUri: string,
  { fs, getSourceCode }: Pick<Dependencies, 'fs' | 'getSourceCode'>,
): Promise<WebComponentMap> {
  const webComponentDefs: WebComponentMap = new Map();
  const assetRoot = path.join(rootUri, 'assets');
  const jsFiles = await recursiveReadDirectory(fs, assetRoot, ([fileName]) =>
    fileName.endsWith('.js'),
  );

  await Promise.all(
    jsFiles.map((uri) =>
      findWebComponentReferences(uri, assetRoot, getSourceCode, webComponentDefs),
    ),
  );

  return webComponentDefs;
}

export async function findWebComponentReferences(
  uri: string,
  assetRoot: string,
  getSourceCode: Dependencies['getSourceCode'],
  result: WebComponentMap,
): Promise<Void> {
  const sourceCode = await getSourceCode(uri);
  if (sourceCode.type !== 'javascript') {
    return;
  }

  const ast = sourceCode.ast;
  if (ast instanceof Error) {
    return;
  }

  for (const node of ast.body) {
    visit(node, {
      Literal(node, _state, ancestors) {
        if (typeof node.value === 'string' && wcre.test(node.value)) {
          // Making sure we're looking at customElements.define calls
          const parentNode = ancestors.at(-2);
          if (!parentNode) return;
          if (parentNode.type !== 'CallExpression') return;
          const callee = (parentNode as CallExpression).callee;
          if (callee.type !== 'MemberExpression') return;
          const property = callee.property;
          if (property.type !== 'Identifier') return;
          if (property.name !== 'define') return;

          result.set(node.value, {
            assetName: path.relative(uri, assetRoot),
            range: [property.start, node.end],
          });
        }
        return null;
      },
    });
  }
}
