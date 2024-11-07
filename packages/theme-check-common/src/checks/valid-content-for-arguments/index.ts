import { ContentForMarkup, NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

// content_for "block" and content_for "blocks" only allow `context.*` kwargs.
const isContextArgument = (argName: string) => argName.startsWith('context.');

export const ValidContentForArguments: LiquidCheckDefinition = {
  meta: {
    code: 'ValidContentForArguments',
    name: 'Prevent the use of invalid arguments to the content_for tag',
    docs: {
      description:
        'This check is aimed at preventing the use of invalid arguments for the content_for tag.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-content-for-arguments',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const validationStrategies = {
      blocks: (node: ContentForMarkup) => {
        const problematicArguments = node.args.filter((arg) => !isContextArgument(arg.name));
        for (const arg of problematicArguments) {
          context.report({
            message: `{% content_for "blocks" %} only accepts 'context.*' arguments`,
            startIndex: arg.position.start,
            endIndex: arg.position.end,
          });
        }
      },

      block: (node: ContentForMarkup) => {
        const requiredArguments = ['id', 'type'];

        // Make sure the id and string arguments are present and are strings
        for (const requiredArgumentName of requiredArguments) {
          const arg = node.args.find((arg) => arg.name === requiredArgumentName);

          if (!arg) {
            context.report({
              message: `{% content_for "block" %} requires a '${requiredArgumentName}' argument`,
              startIndex: node.position.start,
              endIndex: node.position.end,
              suggest: [],
            });
            continue;
          }

          const argValueNode = arg.value;
          if (argValueNode.type !== NodeTypes.String) {
            context.report({
              message: `The '${requiredArgumentName}' argument should be a string`,
              startIndex: argValueNode.position.start,
              endIndex: argValueNode.position.end,
              suggest: [],
            });
          }
        }

        const problematicArguments = node.args.filter(
          (arg) => !(requiredArguments.includes(arg.name) || isContextArgument(arg.name)),
        );

        for (const arg of problematicArguments) {
          context.report({
            message: `{% content_for "block" %} only accepts 'id', 'type' and 'context.*' arguments`,
            startIndex: arg.position.start,
            endIndex: arg.position.end,
          });
        }
      },
    };

    return {
      async LiquidTag(node) {
        if (node.name !== 'content_for' || typeof node.markup === 'string') {
          return;
        }

        /** "block", "blocks", etc. */
        const contentForType = node.markup.contentForType.value;
        const validate = validationStrategies[contentForType as keyof typeof validationStrategies];
        if (!validate) {
          return;
        }

        validate(node.markup);
      },
    };
  },
};
