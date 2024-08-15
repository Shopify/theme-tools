import {
  LiquidHtmlNode,
  LiquidString,
  LiquidVariable,
  LiquidVariableOutput,
  NodeTypes,
  TextNode,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, SchemaProp, Severity, SourceCodeType } from '../../types';
import { last } from '../../utils';
import {
  hasRemoteAssetSizeExceededThreshold,
  hasLocalAssetSizeExceededThreshold,
} from '../../utils/file-utils';
import {
  ValuedHtmlAttribute,
  isAttr,
  isNodeOfType,
  isValuedHtmlAttribute,
  valueIncludes,
} from '../utils';

const schema = {
  thresholdInBytes: SchemaProp.number(100000),
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

export const AssetSizeCSS: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: 'AssetSizeCSS',
    aliases: ['AssetSizeCSSStylesheetTag'],
    name: 'Prevent Large CSS bundles',
    docs: {
      description: 'This check is aimed at preventing large CSS bundles for speed.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/asset-size-css',
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
          message: `The CSS file size exceeds the threshold of ${thresholdInBytes} bytes`,
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
          message: `The CSS file size exceeds the threshold of ${thresholdInBytes} bytes`,
          startIndex: position.start,
          endIndex: position.end,
        });
      }
    }

    return {
      async HtmlVoidElement(node) {
        if (node.name !== 'link') return;

        const relIsStylesheet = node.attributes
          .filter(isValuedHtmlAttribute)
          .find((attr) => isAttr(attr, 'rel') && valueIncludes(attr, 'stylesheet'));
        if (!relIsStylesheet) return;

        const href: ValuedHtmlAttribute | undefined = node.attributes
          .filter(isValuedHtmlAttribute)
          .find((attr) => isAttr(attr, 'href'));
        if (!href) return;
        if (href.value.length !== 1) return;

        /* This ensures that the link entered is a text and not anything else like http//..{}
           This also checks if the value starts with 'http://', 'https://' or '//' to ensure its a valid link. */
        if (isTextNode(href.value[0]) && /(https?:)?\/\//.test(href.value[0].value)) {
          const url = href.value[0].value;
          await checkRemoteAssetSize(url, href.attributePosition);
        }

        /* This code checks if we have a link with a liquid variable
        and that its a string with one filter, `asset_url`. This is done to ensure our .css link is
        entered with a 'asset_url' to produce valid output. */
        if (
          isLiquidVariableOutput(href.value[0]) &&
          isLiquidVariable(href.value[0].markup) &&
          isString(href.value[0].markup.expression) &&
          href.value[0].markup.filters.length === 1 &&
          href.value[0].markup.filters[0].name === 'asset_url'
        ) {
          const assetName = href.value[0].markup.expression.value;
          await checkThemeAssetSize(assetName, href.attributePosition);
        }
      },

      async LiquidFilter(node, ancestors) {
        if (node.name !== 'stylesheet_tag') return;

        const liquidVariableParent = last(ancestors);

        if (!liquidVariableParent || !isNodeOfType(NodeTypes.LiquidVariable, liquidVariableParent))
          return;

        if (liquidVariableParent.expression.type !== NodeTypes.String) return;

        /* This code ensures we have a liquid variable with 1 expression, 1 filter, and that it is a valid http link.
           This is done to ensure a valid http link is entered with 1 filter being the `stylesheet_tag` for valid output. */
        if (
          liquidVariableParent.expression.value[0].length == 1 &&
          liquidVariableParent.filters.length == 1 &&
          /(https?:)?\/\//.test(liquidVariableParent.expression.value)
        ) {
          const url = liquidVariableParent.expression.value;
          await checkRemoteAssetSize(url, liquidVariableParent.expression.position);
        }

        /* This code ensures we have a liquid variable with 1 expression, 2 filters being asset_url and stylesheet_tag
           This is done to ensure a .css file has the 'asset_url' and 'stylesheet_tag' to produce the appropriate output. */
        if (
          liquidVariableParent.expression.value[0].length == 1 &&
          liquidVariableParent.filters.length == 2 &&
          liquidVariableParent.filters[0].name === 'asset_url' &&
          liquidVariableParent.filters[1].name === 'stylesheet_tag'
        ) {
          const css = liquidVariableParent.expression.value;
          await checkThemeAssetSize(css, liquidVariableParent.position);
        }
      },
    };
  },
};
