import { NodeTypes } from '@shopify/liquid-html-parser';
import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';
import { isAttr, isNodeOfType, isValuedHtmlAttribute, ValuedHtmlAttribute } from '../utils';

const ROUTES: Record<string, string> = {
  '/': 'root_url',
  '/account': 'account_url',
  '/account/addresses': 'account_addresses_url',
  '/account/login': 'account_login_url',
  '/account/logout': 'account_logout_url',
  '/account/recover': 'account_recover_url',
  '/account/register': 'account_register_url',
  '/cart': 'cart_url',
  '/cart/add': 'cart_add_url',
  '/cart/change': 'cart_change_url',
  '/cart/clear': 'cart_clear_url',
  '/cart/update': 'cart_update_url',
  '/collections': 'collections_url',
  '/collections/all': 'all_products_collection_url',
  '/customer_authentication/login': 'storefront_login_url',
  '/recommendations/products': 'product_recommendations_url',
  '/search': 'search_url',
  '/search/suggest': 'predictive_search_url',
};

const HARDCODED_ROUTES = Object.keys(ROUTES).reverse();

export const HardcodedRoutes: LiquidCheckDefinition = {
  meta: {
    code: 'HardcodedRoutes',
    name: 'Hardcoded Routes',
    docs: {
      description: 'This check encourages using the routes object instead of hardcoding URLs.',
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
        // checks for hardcoded routes in href and action attributes
        const attrWithHardcodedRoute: ValuedHtmlAttribute | undefined = node.attributes
          .filter(isValuedHtmlAttribute)
          .find((attr) => (isAttr(attr, 'action') || isAttr(attr, 'href')) && hardcodedRoute(attr));

        if (attrWithHardcodedRoute) {
          const attr = attrWithHardcodedRoute;
          const route = hardcodedRoute(attr)!;
          const routeURL = ROUTES[route];
          const startIndex = attr.attributePosition.start;
          const endIndex = startIndex + route.length;

          context.report({
            message: `Use routes object {{ routes.${routeURL} }} instead of hardcoding ${route}`,
            startIndex,
            endIndex,
          });
        }
      },

      async LiquidFilter(node) {
        // checks for hardcoded routes in link_to values {{ 'Cart' | link_to: '/cart' }}
        if (node.name !== 'link_to') return;

        const linkToArg = node.args[0];
        const linkToValue = linkToArg.type === 'String' ? linkToArg.value : '';
        const route = HARDCODED_ROUTES.find((route) =>
          route === '/' ? route === linkToValue : linkToValue.startsWith(route),
        );

        if (route) {
          const routeURL = ROUTES[route];
          // we add 1 to the start index to exclude the quotes
          const startIndex = linkToArg.position.start + 1;

          context.report({
            message: `Use routes object {{ routes.${routeURL} }} instead of hardcoding ${route}`,
            startIndex,
            endIndex: startIndex + route.length,
          });
        }
      },
    };
  },
};

function hardcodedRoute(attr: ValuedHtmlAttribute): string | undefined {
  if (!isNodeOfType(NodeTypes.TextNode, attr.value[0])) return;

  const value = attr.value[0].value;

  return HARDCODED_ROUTES.find((route) =>
    route === '/' ? route === value && attr.value.length === 1 : value.startsWith(route),
  );
}
