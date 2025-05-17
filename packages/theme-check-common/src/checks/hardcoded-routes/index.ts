import { NodeTypes, TextNode } from '@shopify/liquid-html-parser';
import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';
import {
  isAttr,
  isNodeOfType,
  isValuedHtmlAttribute,
  ValuedHtmlAttribute,
  valueIncludes,
} from '../utils';

export const HardcodedRoutes: LiquidCheckDefinition = {
  meta: {
    code: 'HardcodedRoutes',
    name: 'Hardcoded Routes',
    docs: {
      description:
        'This check is aimed at encouraging use of the routes object instead of hardcoding URLs.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/hardcoded-routes',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async HtmlElement(node) {
        const attrWithHardcodedRoute: ValuedHtmlAttribute | undefined = node.attributes
          .filter(isValuedHtmlAttribute)
          .find(
            (attr) =>
              (isAttr(attr, 'action') || isAttr(attr, 'href')) &&
              isNodeOfType(NodeTypes.TextNode, attr.value[0]) &&
              isHardcodedRoute(attr),
          );

        if (attrWithHardcodedRoute) {
          const attr = attrWithHardcodedRoute;
          const route = (attr.value[0] as TextNode).value;
          const routeURL = ROUTES[route];

          context.report({
            message: `Use routes object {{ routes.${routeURL} }} instead of hardcoding ${route}`,
            startIndex: attr.attributePosition.start,
            endIndex: attr.attributePosition.end,
          });
        }
      },
    };
  },
};

function isHardcodedRoute(attr: ValuedHtmlAttribute): boolean {
  return HARDCODED_ROUTES.some((route) => valueIncludes(attr, route));
}

const ROUTES: Record<string, string> = {
  '/account/addresses': 'account_addresses_url',
  '/account/login': 'account_login_url',
  '/account/logout': 'account_logout_url',
  '/account/recover': 'account_recover_url',
  '/account/register': 'account_register_url',
  '/account': 'account_url',
  '/collections/all': 'all_products_collection_url',
  '/cart/add': 'cart_add_url',
  '/cart/change': 'cart_change_url',
  '/cart/clear': 'cart_clear_url',
  '/cart/update': 'cart_update_url',
  '/cart': 'cart_url',
  '/collections': 'collections_url',
  '/search/suggest': 'predictive_search_url',
  '/recommendations/products': 'product_recommendations_url',
  '/': 'root_url',
  '/search': 'search_url',
  '/customer_authentication/login': 'storefront_login_url',
};

const HARDCODED_ROUTES = Object.keys(ROUTES);
