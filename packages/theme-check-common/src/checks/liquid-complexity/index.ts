import { SchemaProp, Severity, SourceCodeType, type LiquidCheckDefinition } from '../../types';
import {
  NodeTypes,
  type LiquidBranch,
  type LiquidHtmlNode,
  type LiquidLogicalExpression,
  type LiquidTag,
} from '@shopify/liquid-html-parser';
import { findLastIndex } from '../../utils';

/**
 * 120 tolerates Horizon's current maximum while still flagging Dawn's top
 * outlier. Threshold research top 3 measured files:
 *
 * +------------+-----------------------------------------------+------------+
 * | Theme      | File                                          | Complexity |
 * +------------+-----------------------------------------------+------------+
 * | Dawn       | snippets/facets.liquid                        | 134        |
 * | Dawn       | snippets/card-product.liquid                  | 112        |
 * | Dawn       | sections/main-product.liquid                  | 105        |
 * | Horizon    | snippets/header-drawer.liquid                 | 114        |
 * | Horizon    | sections/hero.liquid                          | 109        |
 * | Horizon    | snippets/product-media-gallery-content.liquid | 108        |
 * | base-theme | layout/theme.liquid                           | 51         |
 * | base-theme | blocks/_text-field.liquid                     | 42         |
 * | base-theme | blocks/video.liquid                           | 33         |
 * +------------+-----------------------------------------------+------------+
 *
 * Measured:
 *   - Dawn       9ccdacf81f175c7caeebc28348e50bcb02ef8fc7
 *   - Horizon    70c27a8050f66d653c4d30a3974ff07d919e4310
 *   - base-theme 91dc493f91e968b23ed00d6ab8ef569ca720d1a4 (ose-next-theme)
 */
export const TOLERATED_LIQUID_COMPLEXITY = 120;

const schema = {
  maxComplexity: SchemaProp.number(TOLERATED_LIQUID_COMPLEXITY),
};

// Rules: start each file at 1, count each branching/looping Liquid tag, count
// each elsif/when branch, and count each logical and/or expression in Liquid
// control-flow conditions. Non-branching tags such as render, assign, echo, and
// else are intentionally excluded.
const COUNTED_TAGS = new Set(['if', 'unless', 'case', 'for', 'tablerow', 'paginate']);
const COUNTED_BRANCHES = new Set(['elsif', 'when']);
const TAGS_WITH_CONDITIONS = new Set(['if', 'unless']);
const BRANCHES_WITH_CONDITIONS = new Set(['elsif']);

interface SourceRange {
  startIndex: number;
  endIndex: number;
}

export const LiquidComplexity: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: 'LiquidComplexity',
    name: 'LiquidComplexity',
    docs: {
      description: 'Reports Liquid files with high cyclomatic complexity.',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema,
    targets: [],
  },

  create(context) {
    const maxComplexity = context.settings.maxComplexity;
    const state = { complexity: 1 };
    let firstOverThresholdRange: SourceRange | undefined;

    function rangeFor(node: LiquidTag | LiquidBranch | LiquidLogicalExpression): SourceRange {
      if ('blockStartPosition' in node) {
        return {
          startIndex: node.blockStartPosition.start,
          endIndex: node.blockStartPosition.end,
        };
      }

      return {
        startIndex: node.position.start,
        endIndex: node.position.end,
      };
    }

    function incrementComplexity(node: LiquidTag | LiquidBranch | LiquidLogicalExpression): void {
      state.complexity += 1;

      if (!firstOverThresholdRange && state.complexity > maxComplexity) {
        firstOverThresholdRange = rangeFor(node);
      }
    }

    function isLogicalExpressionInControlFlowCondition(ancestors: LiquidHtmlNode[]): boolean {
      const nearestLiquidAncestorIndex = findLastIndex(ancestors, (ancestor) =>
        [NodeTypes.LiquidTag, NodeTypes.LiquidBranch, NodeTypes.LiquidVariableOutput].includes(
          ancestor.type,
        ),
      );

      if (nearestLiquidAncestorIndex === -1) return false;

      const nearestLiquidAncestor = ancestors[nearestLiquidAncestorIndex];

      if (nearestLiquidAncestor.type === NodeTypes.LiquidTag) {
        return TAGS_WITH_CONDITIONS.has(nearestLiquidAncestor.name);
      }

      if (nearestLiquidAncestor.type === NodeTypes.LiquidBranch) {
        return BRANCHES_WITH_CONDITIONS.has(nearestLiquidAncestor.name ?? '');
      }

      return false;
    }

    function lineForIndex(index: number): number {
      return context.file.source.slice(0, index).split('\n').length;
    }

    return {
      async LiquidTag(node: LiquidTag) {
        if (COUNTED_TAGS.has(node.name)) {
          incrementComplexity(node);
        }
      },

      async LiquidBranch(node: LiquidBranch) {
        if (COUNTED_BRANCHES.has(node.name ?? '')) {
          incrementComplexity(node);
        }
      },

      async LogicalExpression(node: LiquidLogicalExpression, ancestors: LiquidHtmlNode[]) {
        if (!isLogicalExpressionInControlFlowCondition(ancestors)) return;

        incrementComplexity(node);
      },

      async onCodePathEnd() {
        if (state.complexity <= maxComplexity) return;

        const range = firstOverThresholdRange ?? {
          startIndex: 0,
          endIndex: context.file.source.length,
        };
        const line = lineForIndex(range.startIndex);

        context.report({
          message: `Liquid complexity is ${state.complexity}, which exceeds the maximum of ${maxComplexity}. The decision at line ${line} pushed it over the limit. Consider simplifying conditional logic, or moving self-contained decision logic into snippets with the render tag.`,
          startIndex: range.startIndex,
          endIndex: range.endIndex,
        });
      },
    };
  },
};
