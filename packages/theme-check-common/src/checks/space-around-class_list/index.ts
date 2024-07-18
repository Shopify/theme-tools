import { LiquidHtmlNode, NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export const SpaceAroundClassList: LiquidCheckDefinition = {
  meta: {
    code: 'SpaceAroundClassList',
    aliases: ['SpaceAroundClassList'],
    name: 'Space Around Class List',
    docs: {
      description: 'Warns you when there is no space before or after using the class_list filter',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/space-around-class_list',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidFilter(node, ancestors) {
        if (node.name !== 'class_list') {
          return;
        }

        const classAttribute = ancestors.find(
          (ancestor) =>
            ancestor.type === NodeTypes.AttrDoubleQuoted ||
            ancestor.type === NodeTypes.AttrSingleQuoted,
        );

        if (!classAttribute) {
          return;
        }

        const classAttributeContent =
          classAttribute.source.slice(classAttribute.position.start, classAttribute.position.end) ||
          '';

        // check for missing space after class_list
        const afterRegex = /([a-zA-Z0-9._-]+)\s*\|\s*class_list\s*}}([a-zA-Z0-9._-]+)/gm;
        const afterMatches = [...classAttributeContent.matchAll(afterRegex)];

        for (const match of afterMatches) {
          if (match.index === undefined) {
            continue;
          }

          const styleSetting = getStyleSetting(ancestors);

          if (styleSetting !== match[1]) {
            continue;
          }

          const bracketIndex = match[0].indexOf('}}');
          const errorPosition = classAttribute.position.start + match.index + bracketIndex + 2;

          context.report({
            message: `Missing a space after using the class_list filter: '${match[0]}'`,
            startIndex: errorPosition,
            endIndex: errorPosition + 1,
            suggest: [
              {
                message: 'Add a space after the class_list filter',
                fix(corrector) {
                  corrector.insert(errorPosition, ' ');
                },
              },
            ],
          });
        }

        // check for missing space before class_list
        const beforeRegex = /([a-zA-Z0-9._-]+){{\s*([a-zA-Z0-9._-]+)\s*\|\s*class_list/gm;
        const beforeMatches = [...classAttributeContent.matchAll(beforeRegex)];

        for (const match of beforeMatches) {
          if (match.index === undefined) {
            continue;
          }

          const styleSetting = getStyleSetting(ancestors);

          if (styleSetting !== match[2]) {
            continue;
          }

          const liquidVariableOutput = ancestors.find(
            (ancestor) => ancestor.type === NodeTypes.LiquidVariableOutput,
          );

          if (!liquidVariableOutput) {
            continue;
          }

          const errorPosition = liquidVariableOutput?.position.start - 1;

          context.report({
            message: `Missing a space before using the class_list filter: '${match[0]}'`,
            startIndex: errorPosition,
            endIndex: errorPosition + 1,
            suggest: [
              {
                message: 'Add a space before the class_list filter',
                fix(corrector) {
                  corrector.insert(errorPosition + 1, ' ');
                },
              },
            ],
          });
        }
      },
    };
  },
};

function getStyleSetting(ancestors: LiquidHtmlNode[]) {
  const liquidVariable = ancestors.find((ancestor) => ancestor.type === NodeTypes.LiquidVariable);
  const liquidVariableContent =
    liquidVariable?.source.slice(liquidVariable.position.start, liquidVariable.position.end) || '';

  return liquidVariableContent.split('|')[0]?.trim();
}
