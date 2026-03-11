"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteAsset = void 0;
const types_1 = require("../../types");
const utils_1 = require("../utils");
const utils_2 = require("../../utils");
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
function isLiquidVariableOutput(node) {
    return node.type === types_1.LiquidHtmlNodeTypes.LiquidVariableOutput;
}
function isLiquidVariable(node) {
    return typeof node !== 'string' && node.type === types_1.LiquidHtmlNodeTypes.LiquidVariable;
}
function isHashUrl(url) {
    return url.startsWith('#');
}
/**
 * Checks if the attribute value starts with a variable lookup.
 * When a value starts with a VariableLookup (e.g., {{ source.url }}, {{ image }}),
 * we can't statically analyze what it contains, so we skip linting.
 * This prevents false positives for cases like video_source.url which already
 * returns CDN-hosted URLs.
 */
function startsWithVariableLookup(attr) {
    const firstNode = attr.value[0];
    if (!firstNode)
        return false;
    if (!isLiquidVariableOutput(firstNode))
        return false;
    const variable = firstNode.markup;
    if (!isLiquidVariable(variable))
        return false;
    return variable.expression.type === types_1.LiquidHtmlNodeTypes.VariableLookup;
}
function isUrlHostedbyShopify(url, allowedDomains = []) {
    if (/^\/cdn\//.test(url)) {
        return true;
    }
    try {
        const urlObj = new URL(url);
        return [...SHOPIFY_CDN_DOMAINS, ...allowedDomains].includes(urlObj.hostname);
    }
    catch (_error) {
        // Return false for any invalid URLs (missing protocol, malformed URLs, invalid characters etc.)
        // Since we're validating if URLs are Shopify-hosted, any invalid URL should return false
        return false;
    }
}
function valueIsDefinitelyNotShopifyHosted(attr, allowedDomains = []) {
    return attr.value.some((node) => {
        if (node.type === types_1.LiquidHtmlNodeTypes.TextNode && /^(https?:)?\/\//.test(node.value)) {
            if (!isUrlHostedbyShopify(node.value, allowedDomains)) {
                return true;
            }
        }
        if (isLiquidVariableOutput(node)) {
            const variable = node.markup;
            if (isLiquidVariable(variable)) {
                const expression = variable.expression;
                if (expression.type === types_1.LiquidHtmlNodeTypes.String && /^https?:\/\//.test(expression.value)) {
                    if (!isUrlHostedbyShopify(expression.value, allowedDomains)) {
                        return true;
                    }
                }
            }
        }
        return false;
    });
}
function valueIsShopifyHosted(attr) {
    const ASSET_URL_FILTER_NAMES = [...DEPRECATED, ...NON_DEPRECATED];
    const ASSET_URL_OBJECT_NAMES = [LIQUID_OBJECT];
    return attr.value.some((node) => {
        if (!isLiquidVariableOutput(node))
            return false;
        if (!isLiquidVariable(node.markup))
            return false;
        const includesFilter = node.markup.filters.some((filter) => ASSET_URL_FILTER_NAMES.includes(filter.name));
        if (includesFilter)
            return true;
        if ((0, utils_1.isNodeOfType)(types_1.LiquidHtmlNodeTypes.VariableLookup, node.markup.expression)) {
            if (node.markup.expression.name
                ? ASSET_URL_OBJECT_NAMES.includes(node.markup.expression.name)
                : false)
                return true;
        }
        return false;
    });
}
// Takes a list of allowed domains, and normalises them into an expected domain: www.domain.com -> domain.com for equality checks.
function normaliseAllowedDomains(allowedDomains) {
    return allowedDomains
        .map((domain) => {
        try {
            const url = new URL(domain);
            // Hostname can still return www. from https://www.domain.com we want it to be  https://www.domain.com -> domain.com
            return url.hostname.replace(/^www\./, '');
        }
        catch (_error) {
            // we shouldn't return the malformed domain - should be strict and stick to web standards (new URL validation).
            return undefined;
        }
    })
        .filter((domain) => domain !== undefined);
}
const schema = {
    allowedDomains: types_1.SchemaProp.array(types_1.SchemaProp.string()).optional(),
};
exports.RemoteAsset = {
    meta: {
        code: 'RemoteAsset',
        aliases: ['AssetUrlFilters'],
        name: 'Remote Asset',
        docs: {
            description: 'This check is aimed at eliminating unnecessary HTTP connections.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/remote-asset',
            recommended: true,
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema,
        targets: [],
    },
    create(context) {
        const allowedDomains = normaliseAllowedDomains(context.settings.allowedDomains || []);
        function checkHtmlNode(node) {
            if (!RESOURCE_TAGS.includes(node.name))
                return;
            const urlAttribute = node.attributes
                .filter(utils_1.isValuedHtmlAttribute)
                .find((attr) => (0, utils_1.isAttr)(attr, 'src') || (0, utils_1.isAttr)(attr, 'href'));
            if (!urlAttribute)
                return;
            const firstTextNode = urlAttribute.value.find((node) => node.type === types_1.LiquidHtmlNodeTypes.TextNode);
            if (firstTextNode && isHashUrl(firstTextNode.value))
                return;
            if (startsWithVariableLookup(urlAttribute))
                return;
            const isShopifyUrl = urlAttribute.value
                .filter((node) => node.type === types_1.LiquidHtmlNodeTypes.TextNode)
                .some((textNode) => isUrlHostedbyShopify(textNode.value, allowedDomains));
            if (isShopifyUrl)
                return;
            const hasDefinitelyARemoteAssetUrl = valueIsDefinitelyNotShopifyHosted(urlAttribute, allowedDomains);
            if (hasDefinitelyARemoteAssetUrl) {
                context.report({
                    message: 'Asset should be served by the Shopify CDN for better performance.',
                    startIndex: urlAttribute.position.start,
                    endIndex: urlAttribute.position.end,
                });
                return;
            }
            const hasShopifyHostedValue = valueIsShopifyHosted(urlAttribute);
            if (hasShopifyHostedValue)
                return;
            context.report({
                message: 'Use one of the asset_url filters to serve assets for better performance.',
                startIndex: urlAttribute.position.start,
                endIndex: urlAttribute.position.end,
            });
        }
        function checkLiquidFilter(node, ancestors) {
            const tagName = node.name;
            if (!TAGNAMES.includes(tagName))
                return;
            const parentNode = (0, utils_2.last)(ancestors);
            if (!parentNode || !(0, utils_1.isNodeOfType)(types_1.LiquidHtmlNodeTypes.LiquidVariable, parentNode))
                return;
            const hasAsset = parentNode.filters.some((filter) => DEPRECATED.includes(filter.name) || NON_DEPRECATED.includes(filter.name));
            if (hasAsset)
                return;
            const urlNode = parentNode.expression;
            if (urlNode.type === types_1.LiquidHtmlNodeTypes.String &&
                !isUrlHostedbyShopify(urlNode.value, allowedDomains)) {
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
//# sourceMappingURL=index.js.map