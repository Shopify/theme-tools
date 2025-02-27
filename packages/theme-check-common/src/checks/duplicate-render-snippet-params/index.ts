import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { RenderMarkup, LiquidNamedArgument } from '@shopify/liquid-html-parser';
import { StringCorrector } from '../../fixes';

export const DuplicateRenderSnippetParams: LiquidCheckDefinition = {
  meta: {
    code: 'DuplicateRenderSnippetParams',
    name: 'Duplicate Render Snippet Parameters',
    docs: {
      description:
        'This check ensures that no duplicate parameter names are provided when rendering a snippet.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/duplicate-render-snippet-params',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    function findDuplicateParams(args: LiquidNamedArgument[]) {
      const paramNames = new Map<string, LiquidNamedArgument[]>();

      // Group parameters by name
      for (const arg of args) {
        if (!paramNames.has(arg.name)) {
          paramNames.set(arg.name, []);
        }
        paramNames.get(arg.name)!.push(arg);
      }

      // Filter out parameters that only appear once
      return Array.from(paramNames.entries())
        .filter(([_, occurrences]) => occurrences.length > 1)
        .map(([name, occurrences]) => ({ name, occurrences }));
    }

    function removeParameter(
      node: RenderMarkup,
      param: LiquidNamedArgument,
      fixer: StringCorrector,
    ) {
      // Find the start position, accounting for leading comma and whitespace
      const sourceBeforeArg = node.source.slice(0, param.position.start);
      const leadingCommaMatch = sourceBeforeArg.match(/,\s*$/);
      let startPos = param.position.start;

      if (leadingCommaMatch) {
        // If there's a leading comma, remove it too
        startPos = param.position.start - leadingCommaMatch[0].length;
      }

      // Find the end position, accounting for trailing comma and whitespace
      const sourceAfterArg = node.source.substring(param.position.end, node.position.end);
      const trailingCommaMatch = sourceAfterArg.match(/^\s*,/);
      let endPos = param.position.end;

      if (trailingCommaMatch) {
        // If there's a trailing comma, remove it too
        endPos = param.position.end + trailingCommaMatch[0].length;
      }

      return fixer.remove(startPos, endPos);
    }

    return {
      async RenderMarkup(node: RenderMarkup) {
        // Skip if this is a variable render (e.g. {% render variable %})
        if (node.variable) {
          return;
        }

        const duplicates = findDuplicateParams(node.args);

        if (duplicates.length === 0) {
          return;
        }

        // Get the snippet name for better error messages
        const snippetName = node.snippet.type === 'String' ? node.snippet.value : 'unknown';

        // Report each duplicate parameter
        for (const { name, occurrences } of duplicates) {
          // Report on all occurrences after the first one (keep the first, remove duplicates)
          for (let i = 1; i < occurrences.length; i++) {
            const param = occurrences[i];
            context.report({
              message: `Duplicate parameter '${name}' in render tag for snippet '${snippetName}'. This parameter was already defined earlier.`,
              startIndex: param.position.start,
              endIndex: param.position.end,
              suggest: [
                {
                  message: `Remove duplicate parameter '${name}'`,
                  fix: (fixer) => removeParameter(node, param, fixer),
                },
              ],
            });
          }
        }
      },
    };
  },
};
