import {
  LiquidHtmlNode,
  LiquidTag,
  LiquidTagAssign,
  LiquidTagCapture,
  NodeTypes,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, SchemaProp, Severity, SourceCodeType } from '../../types';

import { camelCase, kebabCase, snakeCase } from 'lodash';

const pascalCase = (string: string) => {
  const camelCased = camelCase(string);
  return camelCased.charAt(0).toUpperCase() + camelCased.slice(1);
};

const formatTypes = {
  camelCase: camelCase,
  PascalCase: pascalCase,
  snake_case: snakeCase,
  'kebab-case': kebabCase,
};

type FormatTypes = keyof typeof formatTypes;

const schema = {
  format: SchemaProp.string('snake_case'),
};

export const VariableName: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: 'VariableName',
    name: 'Invalid variable naming format',
    docs: {
      description: 'This check is aimed at using certain variable naming conventions',
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/variable-name',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema,
    targets: [],
  },

  create(context) {
    const wronglyFormattedVariables: Map<string, LiquidTagAssign | LiquidTagCapture> = new Map();

    const formatter = (node: LiquidTagAssign | LiquidTagCapture) => {
      if (!node.markup.name) {
        return {
          valid: false,
        };
      }

      const suggestion = formatTypes[context.settings.format as FormatTypes].call(
        null,
        node.markup.name,
      );

      return {
        valid: node.markup.name === suggestion,
        suggestion,
      };
    };

    return {
      async LiquidTag(node) {
        if (isLiquidTagAssign(node)) {
          if (!formatter(node).valid) {
            wronglyFormattedVariables.set(node.markup.name, node);
          }
        } else if (isLiquidTagCapture(node) && node.markup.name) {
          if (!formatter(node).valid) {
            wronglyFormattedVariables.set(node.markup.name, node);
          }
        }
      },

      async onCodePathEnd() {
        for (const [variable, node] of wronglyFormattedVariables.entries()) {
          context.report({
            message: `The variable '${variable}' uses wrong naming format`,
            startIndex: node.markup.position.start,
            endIndex: node.markup.position.end,
            suggest: [
              {
                message: `Change variable '${variable}' to '${formatter(node).suggestion}'`,
                fix: (corrector) => {
                  const [_, end] = getStartEnd(node.markup.source, node.markup.name!);

                  return corrector.replace(
                    node.markup.position.start,
                    end,
                    formatter(node).suggestion!,
                  );
                },
              },
            ],
          });
        }
      },
    };
  },
};

const getStartEnd = (str: string, sub: string) => [str.indexOf(sub), str.indexOf(sub) + sub.length];

function isLiquidTagAssign(node: LiquidTag): node is LiquidTagAssign {
  return node.name === 'assign' && typeof node.markup !== 'string';
}

function isLiquidTagCapture(node: LiquidHtmlNode): node is LiquidTagCapture {
  return (
    node.type == NodeTypes.LiquidTag && node.name === 'capture' && typeof node.markup !== 'string'
  );
}
