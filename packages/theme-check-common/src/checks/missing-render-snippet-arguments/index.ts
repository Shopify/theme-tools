import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { RenderMarkup } from '@shopify/liquid-html-parser';
import { LiquidDocParameter } from '../../liquid-doc/liquidDoc';
import { isLiquidString } from '../utils';
import { getDefaultValueForType } from '../../liquid-doc/utils';

export const MissingRenderSnippetArguments: LiquidCheckDefinition = {
  meta: {
    code: 'MissingRenderSnippetArguments',
    name: 'Missing Render Snippet Arguments',
    docs: {
      description:
        'This check ensures that all required arguments are provided when rendering a snippet.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/missing-render-snippet-arguments',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    function reportMissingParams(
      missingRequiredParams: LiquidDocParameter[],
      node: RenderMarkup,
      snippetName: string,
    ) {
      for (const param of missingRequiredParams) {
        context.report({
          message: `Missing required argument '${param.name}' in render tag for snippet '${snippetName}'`,
          startIndex: node.position.start,
          endIndex: node.position.end,
          suggest: [
            {
              message: `Add required argument '${param.name}'`,
              fix: (fixer) => {
                const paramToAdd = `, ${param.name}: ${getDefaultValueForType(param.type)}`;

                if (node.args.length == 0) {
                  return fixer.insert(node.position.end - 1, paramToAdd);
                }

                const lastArg = node.args[node.args.length - 1];
                const sourceAfterLastArg = node.source.substring(
                  lastArg.position.end,
                  node.position.end,
                );

                const trailingCommaAndWhitespaceMatch = sourceAfterLastArg.match(/\s*,\s*/);
                if (trailingCommaAndWhitespaceMatch) {
                  // IF there is already a trailing comma after the last arg, we want to find it and replace it with our own while stripping whitespace
                  return fixer.replace(
                    lastArg.position.end,
                    lastArg.position.end + trailingCommaAndWhitespaceMatch[0].length,
                    `${paramToAdd} `,
                  );
                }

                return fixer.insert(lastArg.position.end, paramToAdd);
              },
            },
          ],
        });
      }
    }

    return {
      async RenderMarkup(node: RenderMarkup) {
        if (!isLiquidString(node.snippet)) {
          return;
        }

        const snippetName = node.snippet.value;

        const snippetDef =
          context.getDocDefinition &&
          (await context.getDocDefinition(`snippets/${snippetName}.liquid`));

        if (!snippetDef?.liquidDoc?.parameters) {
          return;
        }

        const providedParams = new Map(node.args.map((arg) => [arg.name, arg]));
        const missingRequiredParams = snippetDef.liquidDoc.parameters.filter(
          (p) => p.required && !providedParams.has(p.name) && p.name !== node.alias?.value,
        );

        reportMissingParams(missingRequiredParams, node, snippetName);
      },
    };
  },
};
