import { Severity, SourceCodeType, type LiquidCheckDefinition } from "@shopify/theme-check-common";
import type { BlockMarkup } from "@editor/liquid-html-parser";
import { isSystemArg } from "../common/block-doc";
import { getBlockSchemaSettings } from "../common/block-schema";

export const BlockArgumentSettingCollision: LiquidCheckDefinition = {
  meta: {
    code: "BlockArgumentSettingCollision",
    name: "Block Argument Setting Collision",
    docs: {
      description:
        "Reports a plain block tag argument whose name matches a setting id in the target block's schema. The author likely intended block.settings.<name>. May overlap with UnrecognizedBlockArguments, which reports the same argument as undeclared.",
      recommended: true,
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
        const settings = await getBlockSchemaSettings(context, blockName);
        if (!settings) return;

        for (const arg of markup.args) {
          if (isSystemArg(arg.name)) continue;
          if (!settings.has(arg.name)) continue;

          context.report({
            message: `The argument '${arg.name}' matches a setting on block '${blockName}'. Did you mean 'block.settings.${arg.name}'?`,
            startIndex: arg.position.start,
            endIndex: arg.position.end,
          });
        }
      },
    };
  },
};
