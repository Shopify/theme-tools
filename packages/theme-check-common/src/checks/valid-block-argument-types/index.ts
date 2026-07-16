import { Severity, SourceCodeType, type LiquidCheckDefinition } from "@shopify/theme-check-common";
import {
  BasicParamTypes,
  inferArgumentType,
  isTypeCompatible,
} from "@shopify/theme-check-common/dist/liquid-doc/utils";
import { NodeTypes, type BlockMarkup } from "@editor/liquid-html-parser";
import { getBlockDocParams, isSystemArg } from "../common/block-doc";

export const ValidBlockArgumentTypes: LiquidCheckDefinition = {
  meta: {
    code: "ValidBlockArgumentTypes",
    name: "Valid Block Argument Types",
    docs: {
      description:
        "Reports type mismatches between block tag arguments and their {% doc %} declarations.",
      recommended: true,
      url: "https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-block-argument-types",
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const knownTypes = new Set(Object.values(BasicParamTypes) as string[]);

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
          if (arg.value.type === NodeTypes.VariableLookup) continue;

          const param = docParams.get(arg.name);
          if (!param || !param.type) continue;

          const expectedType = param.type.toLowerCase();
          if (!knownTypes.has(expectedType)) continue;

          const actualType = inferArgumentType(arg.value as any);
          if (isTypeCompatible(expectedType, actualType)) continue;

          context.report({
            message:
              `Type mismatch for argument '${arg.name}': ` +
              `expected ${param.type}, got ${actualType}`,
            startIndex: arg.value.position.start,
            endIndex: arg.value.position.end,
          });
        }
      },
    };
  },
};
