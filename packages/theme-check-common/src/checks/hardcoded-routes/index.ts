import { NodeTypes, TextNode } from '@shopify/liquid-html-parser';
import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';
import { isAttr, isNodeOfType, isValuedHtmlAttribute, ValuedHtmlAttribute } from '../utils';

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

      async HtmlRawNode(node) {
        if (node.name !== 'script') {
          return;
        }

        const textNodes = node.body.nodes.filter(
          (node) => node.type === NodeTypes.TextNode,
        ) as TextNode[];

        for (const node of textNodes) {
          const value = node.value;
          const lines = value.split('\n');

          let isInComment = false;
          let position = 0;

          for (let line of lines) {
            const trimmedLine = line.trim();
            const linePosition = position;

            position += line.length + 1;

            if (trimmedLine.startsWith('/*')) isInComment = true;
            if (isInComment && trimmedLine.endsWith('*/')) {
              isInComment = false;
              continue;
            }
            if (isInComment || trimmedLine.startsWith('//')) continue;

            const route = HARDCODED_ROUTES.find((route) =>
              route === '/'
                ? trimmedLine.includes(`"/"`) ||
                  trimmedLine.includes(`'/'`) ||
                  trimmedLine.includes('`/`')
                : trimmedLine.includes(route),
            );

            if (!route) {
              continue;
            }

            const routeURL = ROUTES[route];
            const startIndex = node.position.start + linePosition + line.indexOf(route);
            const endIndex = startIndex + route.length;

            context.report({
              message: `Use routes object {{ routes.${routeURL} }} instead of hardcoding ${route}`,
              startIndex,
              endIndex,
            });
          }
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
