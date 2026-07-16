import {
  SchemaProp,
  Severity,
  SourceCodeType,
  type LiquidCheckDefinition,
} from "@shopify/theme-check-common";
import { NodeTypes, type LiquidHtmlNode, type LiquidTag } from "@editor/liquid-html-parser";

/**
 * 10 allows a small buffer above Dawn and Horizon's current maximum while
 * still preventing deeper Liquid control-flow nesting.
 *
 * +------------+-------------------------------+-------+
 * | Theme      | File                          | Depth |
 * +------------+-------------------------------+-------+
 * | Dawn       | sections/footer.liquid        | 8     |
 * | Horizon    | snippets/header-drawer.liquid | 8     |
 * | base-theme | blocks/_pagination.liquid     | 7     |
 * +------------+-------------------------------+-------+
 *
 * Measured:
 *   - Dawn       9ccdacf81f175c7caeebc28348e50bcb02ef8fc7
 *   - Horizon    70c27a8050f66d653c4d30a3974ff07d919e4310
 *   - base-theme f1bcb38b4f03ea64a12eaf5e8a79d2927602e8d7 (ose-next-theme)
 */
export const TOLERATED_LIQUID_NESTING_DEPTH = 10;

const schema = {
  maxDepth: SchemaProp.number(TOLERATED_LIQUID_NESTING_DEPTH),
};

const NESTING_TAGS = new Set(["if", "unless", "for", "case", "tablerow"]);

export const LiquidNestingDepth: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: "LiquidNestingDepth",
    name: "LiquidNestingDepth",
    docs: {
      description: "Reports Liquid files with deeply nested control-flow structures.",
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema,
    targets: [],
  },

  create(context) {
    const maxDepth = context.settings.maxDepth;

    function nestingDepthFor(ancestors: LiquidHtmlNode[]): number {
      const nestingAncestors = ancestors.filter(
        (ancestor) =>
          ancestor.type === NodeTypes.LiquidTag && NESTING_TAGS.has(ancestor.name as string),
      );

      return nestingAncestors.length + 1;
    }

    return {
      async LiquidTag(node: LiquidTag, ancestors: LiquidHtmlNode[]) {
        if (!NESTING_TAGS.has(node.name)) return;

        const depth = nestingDepthFor(ancestors);
        if (depth <= maxDepth) return;

        context.report({
          message: `This Liquid block is nested ${depth} levels deep, which exceeds the maximum allowed depth of ${maxDepth}.`,
          startIndex: node.blockStartPosition.start,
          endIndex: node.blockStartPosition.end,
        });
      },
    };
  },
};
