import {
  LiquidString,
  LiquidVariable,
  LiquidVariableOutput,
  NodeTypes,
  TextNode,
} from '@shopify/liquid-html-parser';
import {
  LiquidCheckDefinition,
  LiquidHtmlNode,
  SchemaProp,
  Severity,
  SourceCodeType,
} from '../../types';
import { last } from '../../utils';
import {
  hasRemoteAssetSizeExceededThreshold,
  hasLocalAssetSizeExceededThreshold,
} from '../../utils/file-utils';
import { ValuedHtmlAttribute, isAttr, isNodeOfType, isValuedHtmlAttribute } from '../utils';

const schema = {
  thresholdInBytes: SchemaProp.number(10000),
};

function isTextNode(node: LiquidHtmlNode): node is TextNode {
  return node.type === NodeTypes.TextNode;
}

function isLiquidVariableOutput(node: LiquidHtmlNode): node is LiquidVariableOutput {
  return node.type === NodeTypes.LiquidVariableOutput;
}

function isLiquidVariable(node: LiquidHtmlNode | string): node is LiquidVariable {
  return typeof node !== 'string' && node.type === NodeTypes.LiquidVariable;
}

function isString(node: LiquidHtmlNode): node is LiquidString {
  return node.type === NodeTypes.String;
}

export const AssetSizeJavaScript: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: 'AssetSizeJavaScript',
    name: 'Prevent Large JavaScript bundles',
    docs: {
      description: 'This check is aimed at preventing large JavaScript bundles for speed.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/asset-size-javascript',
      recommended: false,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema,
    targets: [],
  },

  create(context) {
    if (!context.fileSize) {
      return {};
    }

    const thresholdInBytes = context.settings.thresholdInBytes;

    async function checkRemoteAssetSize(url: string, position: { start: number; end: number }) {
      if (await hasRemoteAssetSizeExceededThreshold(url, thresholdInBytes)) {
        context.report({
          message: `JavaScript on every page load exceeds compressed size threshold (${thresholdInBytes} Bytes), consider using the import on interaction pattern.`,
          startIndex: position.start,
          endIndex: position.end,
        });
      }
    }

    async function checkThemeAssetSize(srcValue: string, position: { start: number; end: number }) {
      if (
        await hasLocalAssetSizeExceededThreshold(context, `assets/${srcValue}`, thresholdInBytes)
      ) {
        context.report({
          message: `JavaScript on every page load exceeds compressed size threshold (${thresholdInBytes} Bytes), consider using the import on interaction pattern.`,
          startIndex: position.start,
          endIndex: position.end,
        });
      }
    }

    return {
      async HtmlRawNode(node) {
        if (node.name !== 'script') return;

        const src: ValuedHtmlAttribute | undefined = node.attributes
          .filter(isValuedHtmlAttribute)
          .find((attr) => isAttr(attr, 'src'));
        if (!src) return;
        if (src.value.length !== 1) return;

        if (isTextNode(src.value[0]) && /(https?:)?\/\//.test(src.value[0].value)) {
          const url = src.value[0].value;
          await checkRemoteAssetSize(url, src.attributePosition);
        }

        if (
          isLiquidVariableOutput(src.value[0]) &&
          isLiquidVariable(src.value[0].markup) &&
          isString(src.value[0].markup.expression) &&
          src.value[0].markup.filters.length === 1 &&
          src.value[0].markup.filters[0].name === 'asset_url'
        ) {
          const assetName = src.value[0].markup.expression.value;
          await checkThemeAssetSize(assetName, src.attributePosition);
        }
      },

      async LiquidFilter(node, ancestors) {
        if (node.name !== 'script_tag') return;

        const liquidVariableParent = last(ancestors);

        if (!liquidVariableParent || !isNodeOfType(NodeTypes.LiquidVariable, liquidVariableParent))
          return;

        if (liquidVariableParent.expression.type !== NodeTypes.String) return;

        if (
          liquidVariableParent.expression.value[0].length == 1 &&
          liquidVariableParent.filters.length == 1 &&
          /(https?:)?\/\//.test(liquidVariableParent.expression.value)
        ) {
          const url = liquidVariableParent.expression.value;
          await checkRemoteAssetSize(url, liquidVariableParent.expression.position);
        }

        if (
          liquidVariableParent.expression.value[0].length == 1 &&
          liquidVariableParent.filters.length == 2 &&
          liquidVariableParent.filters[0].name === 'asset_url' &&
          liquidVariableParent.filters[1].name === 'script_tag'
        ) {
          const js = liquidVariableParent.expression.value;
          await checkThemeAssetSize(js, liquidVariableParent.position);
        }
      },
    };
  },
};
