import {
  LiquidCheckDefinition,
  LiquidHtmlNodeTypes as NodeTypes,
  Severity,
  SourceCodeType,
} from '@shopify/theme-check-common';

function isSimplePropertyEqualTo(node: any, property: string, value: string): boolean {
  if (!(property in node)) return false;
  const propertyValue = node[property];
  if (!Array.isArray(propertyValue)) return false;
  return (
    propertyValue.length === 1 &&
    propertyValue[0].type === NodeTypes.TextNode &&
    propertyValue[0].value === value
  );
}

export const ParserBlockingScript: LiquidCheckDefinition = {
  meta: {
    code: 'ParserBlockingScript',
    name: 'Avoid parser blocking scripts',
    docs: {
      description: 'They are bad ok?',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      // { { 'asset' | asset_url | script_tag } }
      LiquidFilter: async (node, file) => {
        if (node.name !== 'script_tag') return;
        context.report(file, {
          message:
            'The script_tag filter is parser-blocking. Use a <script> tag with async or defer for better performance',
          startIndex: node.position.start,
          endIndex: node.position.end,
        });
      },

      // <script src="...">
      HtmlRawNode: async (node, file) => {
        if (node.name !== 'script') {
          return;
        }

        const hasSrc = !!node.attributes.find((attr) => {
          return isSimplePropertyEqualTo(attr, 'name', 'src');
        });

        if (!hasSrc) {
          return;
        }

        const hasDeferOrAsync = !!node.attributes.find(
          (attr) =>
            isSimplePropertyEqualTo(attr, 'name', 'async') ||
            isSimplePropertyEqualTo(attr, 'name', 'defer'),
        );

        if (hasDeferOrAsync) {
          return;
        }

        context.report(file, {
          message: 'Avoid parser blocking scripts by adding `defer` or `async` on this tag',
          startIndex: node.blockStartPosition.start,
          endIndex: node.blockEndPosition.end,
        });
      },
    };
  },
};
