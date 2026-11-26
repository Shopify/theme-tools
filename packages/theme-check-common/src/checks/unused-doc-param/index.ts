import {
  isLiquidHtmlNode,
  LiquidDocParamNode,
  NodeTypes,
  RenderMarkup,
} from '@shopify/liquid-html-parser';
import { Context, LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isLoopScopedVariable } from '../utils';
import { getSnippetName } from '../../liquid-doc/arguments';
import { toSourceCode } from '../../to-source-code';
import { isSnippet } from '../../to-schema';
import { visit } from '../../visitor';

export const UnusedDocParam: LiquidCheckDefinition = {
  meta: {
    code: 'UnusedDocParam',
    name: 'Prevent unused doc parameters',
    docs: {
      description:
        'This check ensures parameters defined in the `doc` tag are used within the snippet and passed by its callers.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unused-doc-param',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const definedLiquidDocParams: Map<string, LiquidDocParamNode> = new Map();
    const usedVariables: Set<string> = new Set();

    return {
      async LiquidDocParamNode(node) {
        definedLiquidDocParams.set(node.paramName.value, node);
      },

      async VariableLookup(node, ancestors) {
        if (
          node.type === NodeTypes.VariableLookup &&
          node.name &&
          !isLoopScopedVariable(node.name, ancestors)
        ) {
          usedVariables.add(node.name);
        }
      },

      async onCodePathEnd() {
        const hasUsedOptionalParam = [...definedLiquidDocParams].some(
          ([variable, node]) => !node.required && usedVariables.has(variable),
        );
        const providedParams = hasUsedOptionalParam ? await getProvidedParams(context) : undefined;

        for (const [variable, node] of definedLiquidDocParams.entries()) {
          if (!usedVariables.has(variable)) {
            context.report({
              message: `The parameter '${variable}' is defined but not used in this file.`,
              startIndex: node.position.start,
              endIndex: node.position.end,
              suggest: [
                {
                  message: `Remove unused parameter '${variable}'`,
                  fix: (corrector) => corrector.remove(node.position.start, node.position.end),
                },
              ],
            });
          } else if (!node.required && providedParams && !providedParams.has(variable)) {
            context.report({
              message: `The parameter '${variable}' is never passed to this snippet.`,
              startIndex: node.position.start,
              endIndex: node.position.end,
            });
          }
        }
      },
    };
  },
};

/**
 * The parameters that the snippet's `render` callers pass to it. Returns
 * nothing when that can't be known: the snippet has no callers, a caller can't
 * be read, or a caller uses `include`.
 */
async function getProvidedParams(context: Context<SourceCodeType.LiquidHtml>) {
  const { getReferences, fs, file, toRelativePath } = context;
  if (!getReferences || !isSnippet(file.uri)) return;

  const snippetName = toRelativePath(file.uri)
    .replace(/^snippets\//, '')
    .replace(/\.liquid$/, '');
  let references;
  try {
    references = await getReferences(file.uri);
  } catch {
    return;
  }
  const sourceUris = new Set(
    references.filter((reference) => reference.type === 'direct').map(({ source }) => source.uri),
  );
  // A snippet without callers is OrphanedSnippet's to report.
  if (sourceUris.size === 0) return;

  const providedParams = new Set<string>();

  for (const sourceUri of sourceUris) {
    let source: string;
    try {
      source = await fs.readFile(sourceUri);
    } catch {
      return;
    }

    const sourceCode = toSourceCode(sourceUri, source);
    if (sourceCode.type !== SourceCodeType.LiquidHtml || !isLiquidHtmlNode(sourceCode.ast)) return;

    let hasIncludeCaller = false;
    visit<SourceCodeType.LiquidHtml, void>(sourceCode.ast, {
      RenderMarkup(node: RenderMarkup, ancestors) {
        if (getSnippetName(node) !== snippetName) return;
        const tag = ancestors.at(-1);
        if (tag?.type === NodeTypes.LiquidTag && tag.name === 'include') {
          hasIncludeCaller = true;
          return;
        }
        node.args.forEach(({ name }) => providedParams.add(name));
        if (node.variable) providedParams.add(node.alias?.value ?? snippetName);
      },
    });

    // Includes inherit their caller's variables, so explicit arguments alone
    // cannot establish that a documented parameter is never supplied.
    if (hasIncludeCaller) return;
  }

  return providedParams;
}
