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

const isLiquidTagAssign = (node: LiquidTag): node is LiquidTagAssign => {
  return node.name === 'assign' && typeof node.markup !== 'string';
};

const isLiquidTagCapture = (node: LiquidHtmlNode): node is LiquidTagCapture => {
  return (
    node.type == NodeTypes.LiquidTag && node.name === 'capture' && typeof node.markup !== 'string'
  );
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

// It's impossible to make an idempotent rule that works for all cases. We
// have to accept whatever spacing the user has input as valid.
// This function strips dash/underscores around digits so that we can at least
// make sure that the variable name is in the "correct" format. (e.g. snake case)
const collapseNumberSpacing = (varName: string) => varName.replace(/[-_]?\d[-_]?/g, '');

export const VariableName: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: 'VariableName',
    name: 'Invalid variable naming format',
    docs: {
      description: 'This check is aimed at using certain variable naming conventions',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/variable-name',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema,
    targets: [],
  },

  create(context) {
    const formatter = (node: LiquidTagAssign | LiquidTagCapture) => {
      if (!node.markup.name) {
        return {
          valid: false,
        };
      }

      const formatter = formatTypes[context.settings.format as FormatTypes];
      const suggestion = formatter(node.markup.name);

      return {
        valid: collapseNumberSpacing(node.markup.name) === collapseNumberSpacing(suggestion),
        suggestion,
      };
    };

    const reportHandler = (node: LiquidTagAssign | LiquidTagCapture) => {
      return context.report({
        message: `The variable '${node.markup.name}' uses wrong naming format`,
        startIndex: node.markup.position.start,
        endIndex: node.markup.position.end,
        suggest: [
          {
            message: `Change variable '${node.markup.name}' to '${formatter(node).suggestion}'`,
            fix: (corrector) => {
              const { position, name, source } = node.markup;

              return corrector.replace(
                position.start,
                position.end,
                source
                  .slice(position.start, position.end)
                  .replace(name!, formatter(node).suggestion!),
              );
            },
          },
        ],
      });
    };

    return {
      async LiquidTag(node) {
        if (isLiquidTagAssign(node)) {
          if (!formatter(node).valid) {
            reportHandler(node);
          }
        } else if (isLiquidTagCapture(node) && node.markup.name) {
          if (!formatter(node).valid) {
            reportHandler(node);
          }
        }
      },
    };
  },
};
