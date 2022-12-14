import {
  LiquidHtmlNode,
  NodeTypes,
} from '@shopify/prettier-plugin-liquid/dist/types';
import {
  check as coreCheck,
  Offense,
  Config,
  Severity,
  SourceCodeType,
  LiquidCheckDefinition,
} from '../common';

function isSimplePropertyEqualTo(
  node: any,
  property: string,
  value: string,
): boolean {
  if (!(property in node)) return false;
  const propertyValue = node[property];
  if (!Array.isArray(propertyValue)) return false;
  return (
    propertyValue.length === 1 &&
    propertyValue[0].type === NodeTypes.TextNode &&
    propertyValue[0].value === value
  );
}

const ParserBlockingScriptCheck: LiquidCheckDefinition = {
  meta: {
    code: 'ParserBlockingScript',
    name: 'Avoid parser blocking scripts',
    docs: {
      description: 'They are bad ok?',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      HtmlElement: async (node, file) => {
        const isScriptTag = isSimplePropertyEqualTo(node, 'name', 'script');
        if (!isScriptTag) {
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
          message:
            'Avoid parser blocking scripts by adding `defer` or `async` on this tag',
          startIndex: node.blockStartPosition.start,
          endIndex: node.blockEndPosition.end,
        });
      },
    };
  },
};

export function check(root: string): Offense[] {
  const theme = getTheme(root);
  const config: Config = {
    checks: [ParserBlockingScriptCheck],
  };

  return coreCheck(theme, config);
}
