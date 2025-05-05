import {
  HtmlRawNode,
  HtmlVoidElement,
  TextNode,
  LiquidVariable,
  LiquidVariableOutput,
} from '@shopify/liquid-html-parser';
import {
  LiquidHtmlNodeTypes as NodeTypes,
  LiquidHtmlNodeOfType as NodeOfType,
  Severity,
  SourceCodeType,
  LiquidCheckDefinition,
  LiquidHtmlNode,
  SchemaProp,
} from '../../types';
import { isAttr, isValuedHtmlAttribute, isNodeOfType, ValuedHtmlAttribute } from '../utils';
import { last } from '../../utils';

const RESOURCE_TAGS = ['img', 'link', 'source', 'script'];
const SHOPIFY_CDN_DOMAINS = ['fonts.shopifycdn.com', 'cdn.shopify.com'];
const TAGNAMES = ['stylesheet_tag', 'script_tag', 'image_tag', 'img_tag'];
const DEPRECATED = ['product_img_url', 'article_img_url', 'collection_img_url', 'img_url'];

const NON_DEPRECATED = [
  'asset_url',
  'image_url',
  'asset_img_url',
  'file_img_url',
  'file_url',
  'global_asset_url',
  'shopify_asset_url',
  'external_video_url',
  'font_url',
];
const LIQUID_OBJECT = 'canonical_url';

function isLiquidVariableOutput(node: LiquidHtmlNode): node is LiquidVariableOutput {
  return node.type === NodeTypes.LiquidVariableOutput;
}

function isLiquidVariable(node: LiquidHtmlNode | string): node is LiquidVariable {
  return typeof node !== 'string' && node.type === NodeTypes.LiquidVariable;
}

function isUrlHostedbyShopify(url: string, allowedDomains: string[] = []): boolean {
  if (/^\/cdn\//.test(url)) {
    return true;
  }
  try {
    const urlObj = new URL(url);
    return [...SHOPIFY_CDN_DOMAINS, ...allowedDomains].includes(urlObj.hostname);
  } catch (_error) {
    // Return false for any invalid URLs (missing protocol, malformed URLs, invalid characters etc.)
    // Since we're validating if URLs are Shopify-hosted, any invalid URL should return false
    return false;
  }
}

function valueIsDefinitelyNotShopifyHosted(
  attr: ValuedHtmlAttribute,
  allowedDomains: string[] = [],
): boolean {
  return attr.value.some((node) => {
    if (node.type === NodeTypes.TextNode && /^(https?:)?\/\//.test(node.value)) {
      if (!isUrlHostedbyShopify(node.value, allowedDomains)) {
        return true;
      }
    }

    if (isLiquidVariableOutput(node)) {
      const variable = node.markup;
      if (isLiquidVariable(variable)) {
        const expression = variable.expression;
        if (expression.type === NodeTypes.String && /^https?:\/\//.test(expression.value)) {
          if (!isUrlHostedbyShopify(expression.value, allowedDomains)) {
            return true;
          }
        }
      }
    }
    return false;
  });
}

function valueIsShopifyHosted(attr: ValuedHtmlAttribute): boolean {
  const ASSET_URL_FILTER_NAMES = [...DEPRECATED, ...NON_DEPRECATED];
  const ASSET_URL_OBJECT_NAMES = [LIQUID_OBJECT];

  return attr.value.some((node) => {
    if (!isLiquidVariableOutput(node)) return false;
    if (!isLiquidVariable(node.markup)) return false;

    const includesFilter = node.markup.filters.some((filter) =>
      ASSET_URL_FILTER_NAMES.includes(filter.name),
    );
    if (includesFilter) return true;

    if (isNodeOfType(NodeTypes.VariableLookup, node.markup.expression)) {
      if (
        node.markup.expression.name
          ? ASSET_URL_OBJECT_NAMES.includes(node.markup.expression.name)
          : false
      )
        return true;
    }

    return false;
  });
}

// Takes a list of allowed domains, and normalises them into an expected domain: www.domain.com -> domain.com for equality checks.
function normaliseAllowedDomains(allowedDomains: string[]): string[] {
  return allowedDomains
    .map((domain) => {
      try {
        const url = new URL(domain);
        // Hostname can still return www. from https://www.domain.com we want it to be  https://www.domain.com -> domain.com
        return url.hostname.replace(/^www\./, '');
      } catch (_error) {
        // we shouldn't return the malformed domain - should be strict and stick to web standards (new URL validation).
        return undefined;
      }
    })
    .filter((domain): domain is string => domain !== undefined);
}

const schema = {
  allowedDomains: SchemaProp.array(SchemaProp.string()).optional(),
};

export const RemoteAsset: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: 'RemoteAsset',
    aliases: ['AssetUrlFilters'],
    name: 'Remote Asset',
    docs: {
      description: 'This check is aimed at eliminating unnecessary HTTP connections.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/remote-asset',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema,
    targets: [],
  },

  create(context) {
    const allowedDomains = normaliseAllowedDomains(context.settings.allowedDomains || []);

    function checkHtmlNode(node: HtmlVoidElement | HtmlRawNode) {
      if (!RESOURCE_TAGS.includes(node.name)) return;

      const urlAttribute: ValuedHtmlAttribute | undefined = node.attributes
        .filter(isValuedHtmlAttribute)
        .find((attr: ValuedHtmlAttribute) => isAttr(attr, 'src') || isAttr(attr, 'href'));

      if (!urlAttribute) return;

      const isShopifyUrl = urlAttribute.value
        .filter((node): node is TextNode => node.type === NodeTypes.TextNode)
        .some((textNode) => isUrlHostedbyShopify(textNode.value, allowedDomains));

      if (isShopifyUrl) return;

      const hasDefinitelyARemoteAssetUrl = valueIsDefinitelyNotShopifyHosted(
        urlAttribute,
        allowedDomains,
      );
      if (hasDefinitelyARemoteAssetUrl) {
        context.report({
          message: 'Asset should be served by the Shopify CDN for better performance.',
          startIndex: urlAttribute.position.start,
          endIndex: urlAttribute.position.end,
        });
        return;
      }

      const hasShopifyHostedValue = valueIsShopifyHosted(urlAttribute);
      if (hasShopifyHostedValue) return;

      context.report({
        message: 'Use one of the asset_url filters to serve assets for better performance.',
        startIndex: urlAttribute.position.start,
        endIndex: urlAttribute.position.end,
      });
    }

    function checkLiquidFilter(
      node: NodeOfType<NodeTypes.LiquidFilter>,
      ancestors: LiquidHtmlNode[],
    ) {
      const tagName = node.name;

      if (!TAGNAMES.includes(tagName)) return;

      const parentNode = last(ancestors);
      if (!parentNode || !isNodeOfType(NodeTypes.LiquidVariable, parentNode)) return;

      const hasAsset = parentNode.filters.some(
        (filter: { name: string }) =>
          DEPRECATED.includes(filter.name) || NON_DEPRECATED.includes(filter.name),
      );

      if (hasAsset) return;

      const urlNode = parentNode.expression;
      if (
        urlNode.type === NodeTypes.String &&
        !isUrlHostedbyShopify(urlNode.value, allowedDomains)
      ) {
        context.report({
          message: 'Asset should be served by the Shopify CDN for better performance.',
          startIndex: urlNode.position.start,
          endIndex: urlNode.position.end,
        });
      }

      context.report({
        message: `Use one of the asset_url filters to serve assets for better performance.`,
        startIndex: parentNode.expression.position.start,
        endIndex: node.position.end,
      });
    }

    return {
      async HtmlVoidElement(node) {
        checkHtmlNode(node);
      },
      async HtmlRawNode(node) {
        checkHtmlNode(node);
      },
      async LiquidFilter(node, ancestors) {
        checkLiquidFilter(node, ancestors);
      },
    };
  },
};
