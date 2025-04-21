import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { LiquidNamedArgument, RenderMarkup } from '@shopify/liquid-html-parser';
import { isLiquidString } from '../utils';

export const DuplicateRenderSnippetArguments: LiquidCheckDefinition = {
  meta: {
    code: 'DuplicateRenderSnippetArguments',
    name: 'Duplicate Render Snippet Arguments',
    docs: {
      description:
        'This check ensures that no duplicate argument names are provided when rendering a snippet.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/duplicate-render-snippet-arguments',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async RenderMarkup(node: RenderMarkup) {
        if (!isLiquidString(node.snippet)) {
          return;
        }

        const snippetName = node.snippet.value;

        const encounteredParams = new Set<string>();
        for (const param of node.args) {
          const paramName = param.name;
          if (encounteredParams.has(paramName) || paramName === node.alias?.value) {
            context.report({
              message: `Duplicate argument '${paramName}' in render tag for snippet '${snippetName}'.`,
              startIndex: param.position.start,
              endIndex: param.position.end,
              suggest: [
                {
                  message: `Remove duplicate argument '${paramName}'`,
                  fix: (fixer) => {
                    // This argument removal logic is duplicated in UnrecognizedRenderSnippetArguments
                    // Consider extracting to a shared utility or simplifying the removal approach in the parsing steps.
                    // I chose not to do so here as I would like more examples to see how this should be done.
                    const sourceBeforeArg = node.source.slice(
                      node.position.start,
                      param.position.start,
                    );
                    const matches = sourceBeforeArg.match(/,\s*/g);
                    const lastCommaMatch = matches?.[matches.length - 1];
                    let startPos = lastCommaMatch
                      ? param.position.start - (lastCommaMatch.length - 1)
                      : param.position.start;

                    if (isLastParam(node, param)) {
                      // Remove the leading comma if it's the last parameter
                      startPos -= 1;
                    }

                    const sourceAfterArg = node.source.substring(
                      param.position.end,
                      node.position.end,
                    );
                    const trailingCommaMatch = sourceAfterArg.match(/\s*,/);
                    if (trailingCommaMatch) {
                      return fixer.remove(
                        startPos,
                        param.position.end + trailingCommaMatch[0].length,
                      );
                    }
                    return fixer.remove(startPos, param.position.end);
                  },
                },
              ],
            });
            continue;
          } else {
            encounteredParams.add(param.name);
          }
        }
      },
    };
  },
};

export function isLastParam(node: RenderMarkup, param: LiquidNamedArgument): boolean {
  return (
    node.args.length == 1 || param.position.start == node.args[node.args.length - 1].position.start
  );
}
