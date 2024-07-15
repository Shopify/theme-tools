import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export const SpaceAfterClassList: LiquidCheckDefinition = {
  meta: {
    code: 'SpaceAfterClassList',
    aliases: ['SpaceAfterClassList'],
    name: 'Space After Class List',
    docs: {
      description: 'Warns you when there is no space after using the class_list filter',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/space-after-class_list',
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

        const regex = /([a-zA-Z0-9._-]+)\s*\|\s*class_list\s*}}([a-zA-Z0-9._-]+)/gm;

        const matches = [...classAttributeContent.matchAll(regex)];

        for (const match of matches) {
          if (match.index === undefined) {
            continue;
          }

          const liquidVariable = ancestors.find(
            (ancestor) => ancestor.type === NodeTypes.LiquidVariable,
          );
          const liquidVariableContent =
            liquidVariable?.source.slice(
              liquidVariable.position.start,
              liquidVariable.position.end,
            ) || '';
          const styleSetting = liquidVariableContent.split('|')[0]?.trim();

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
      },
    };
  },
};
