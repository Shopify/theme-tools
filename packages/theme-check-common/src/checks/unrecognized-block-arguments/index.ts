import { Severity, SourceCodeType, type LiquidCheckDefinition } from "@shopify/theme-check-common";
import type { BlockMarkup } from "@editor/liquid-html-parser";
import { getBlockDocParams, isSystemArg } from "../common/block-doc";

export const UnrecognizedBlockArguments: LiquidCheckDefinition = {
  meta: {
    code: "UnrecognizedBlockArguments",
    name: "Unrecognized Block Arguments",
    docs: {
      description:
        "Reports arguments in a block tag that are not declared in the block's {% doc %} tag.",
      recommended: true,
      url: "https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unrecognized-block-arguments",
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
        const docParams = await getBlockDocParams(context, blockName);
        if (!docParams) return;

        for (const arg of markup.args) {
          if (isSystemArg(arg.name)) continue;
          if (docParams.has(arg.name)) continue;

          context.report({
            message: `Unknown argument '${arg.name}' in block tag for '${blockName}'.`,
            startIndex: arg.position.start,
            endIndex: arg.position.end,
          });
        }
      },
    };
  },
};
