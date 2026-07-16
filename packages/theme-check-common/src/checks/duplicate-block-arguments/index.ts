import { Severity, SourceCodeType, type LiquidCheckDefinition } from "@shopify/theme-check-common";
import type { BlockMarkup } from "@editor/liquid-html-parser";

export const DuplicateBlockArguments: LiquidCheckDefinition = {
  meta: {
    code: "DuplicateBlockArguments",
    name: "Duplicate Block Arguments",
    docs: {
      description: "Reports duplicate argument names in a block tag.",
      recommended: true,
      url: "https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/duplicate-block-arguments",
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidTag(node) {
        if (node.name !== "block") return;
        if (typeof node.markup === "string") return;

        const markup = node.markup as BlockMarkup;
        const blockName = markup.name.value;
        const seen = new Set<string>();

        for (const arg of markup.args) {
          if (seen.has(arg.name)) {
            context.report({
              message: `Duplicate argument '${arg.name}' in block tag for '${blockName}'.`,
              startIndex: arg.position.start,
              endIndex: arg.position.end,
            });
          } else {
            seen.add(arg.name);
          }
        }
      },
    };
  },
};
