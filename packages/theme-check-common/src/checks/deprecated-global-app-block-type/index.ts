import {
  LiquidBranchNamed,
  LiquidConditionalExpression,
  LiquidHtmlNode,
  LiquidTag,
  NamedTags,
  NodeTypes,
} from '@shopify/liquid-html-parser';
import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';

function isGlobalStringNode(node: string | LiquidConditionalExpression): node is NodeTypes.String {
  return typeof node !== 'string' && node.type === NodeTypes.String && node.value === '@global';
}

function isNamedBranch(node: LiquidHtmlNode): node is LiquidBranchNamed {
  return node.type === NodeTypes.LiquidBranch && node.name !== null;
}

export const DeprecatedGlobalAppBlockType: LiquidCheckDefinition = {
  meta: {
    code: 'DeprecatedGlobalAppBlockType',
    name: 'Deprecated Global App Block Type',
    docs: {
      description: 'Check for deprecated global app block type `@global`',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/deprecated-global-app-block-type',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    function report(position: { start: number; end: number }) {
      context.report({
        message: 'The global app block type `@global` is deprecated. Use `@app` instead.',
        startIndex: position.start,
        endIndex: position.end,
      });
    }
    function hasGlobal(markup: string | LiquidConditionalExpression): boolean {
      if (typeof markup === 'string') {
        return markup.includes('@global');
      } else if (markup.type === NodeTypes.Comparison) {
        return hasGlobal(markup.left) || hasGlobal(markup.right);
      }
      return isGlobalStringNode(markup);
    }

    function checkBranch(node: LiquidBranchNamed | LiquidTag) {
      if ((node.name === NamedTags.if || node.name === NamedTags.elsif) && hasGlobal(node.markup)) {
        report({ start: node.blockStartPosition.start, end: node.blockStartPosition.end });
      } else if (
        node.name === NamedTags.when &&
        typeof node.markup !== 'string' &&
        node.markup.some(isGlobalStringNode)
      ) {
        report({ start: node.blockStartPosition.start, end: node.blockStartPosition.end });
      }

      if (node.type === NodeTypes.LiquidTag && Array.isArray(node.children)) {
        node.children.filter(isNamedBranch).forEach(checkBranch);
      }
    }

    return {
      async LiquidTag(node) {
        if (!node.children) return;
        if (node.name === NamedTags.if || node.name === NamedTags.case) checkBranch(node);
      },

      async LiquidRawTag(node) {
        if (node.name === 'schema') {
          const schema = JSONSafeParse(node.body.value);
          if ('blocks' in schema && Array.isArray(schema.blocks)) {
            schema.blocks.forEach((block: unknown) => {
              if (
                typeof block === 'object' &&
                block !== null &&
                'type' in block &&
                block.type === '@global'
              ) {
                const globalIndex = node.body.value.indexOf('"@global"');
                const lineStart = node.body.value.lastIndexOf('\n', globalIndex);
                const lineEnd = node.body.value.indexOf('\n', globalIndex);
                const excludeSpaces = node.body.value.slice(lineStart + 1, lineEnd).search(/\S|$/);
                const position = {
                  start: node.body.position.start + lineStart + 1 + excludeSpaces,
                  end: node.body.position.start + lineEnd,
                };
                report(position);
              }
            });
          }
        }
      },
    };
  },
};

function JSONSafeParse(body: string): any {
  try {
    return JSON.parse(body);
  } catch (_) {
    return {};
  }
}
