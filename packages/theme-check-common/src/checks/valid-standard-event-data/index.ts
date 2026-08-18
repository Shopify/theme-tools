import { LiquidNamedArgument, NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

const FILTER_NAME = 'standard_event_data';
const CONTEXT_ARGUMENT = 'context';
const SUPPORTED_EVENT_TYPE = 'view';
const CONTEXTS_SUPPORTED_BY_ANY_INPUT_TYPE = [
  'page',
  'search',
  'collection',
  'dialog',
  'recommendation',
];

export const ValidStandardEventData: LiquidCheckDefinition = {
  meta: {
    code: 'ValidStandardEventData',
    name: 'Prevent the use of invalid arguments to the standard_event_data filter',
    docs: {
      description:
        'This check is aimed at preventing the use of invalid arguments for the standard_event_data filter.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-standard-event-data',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidFilter(node) {
        if (node.name !== FILTER_NAME) return;

        const eventType = node.args.find((arg) => arg.type !== NodeTypes.NamedArgument);

        if (eventType?.type === NodeTypes.String && eventType.value !== SUPPORTED_EVENT_TYPE) {
          context.report({
            message: `Unsupported event type '${eventType.value}'. The only supported event type is '${SUPPORTED_EVENT_TYPE}'.`,
            startIndex: eventType.position.start,
            endIndex: eventType.position.end,
          });
        }

        const contextArgument = node.args.find(
          (arg): arg is LiquidNamedArgument =>
            arg.type === NodeTypes.NamedArgument && arg.name === CONTEXT_ARGUMENT,
        );
        const contextValue = contextArgument?.value;

        if (
          contextValue?.type === NodeTypes.String &&
          !CONTEXTS_SUPPORTED_BY_ANY_INPUT_TYPE.includes(contextValue.value)
        ) {
          context.report({
            message: `Unsupported context '${
              contextValue.value
            }'. Valid values: ${CONTEXTS_SUPPORTED_BY_ANY_INPUT_TYPE.join(', ')}`,
            startIndex: contextValue.position.start,
            endIndex: contextValue.position.end,
          });
        }
      },
    };
  },
};
