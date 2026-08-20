import { LiquidExpression, LiquidNamedArgument, NodeTypes } from '@shopify/liquid-html-parser';
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

function isInvalidStaticValue(value: LiquidExpression, supportedValues: string[]): boolean {
  if (value.type === NodeTypes.VariableLookup) return false;
  return value.type !== NodeTypes.String || !supportedValues.includes(value.value);
}

function describeValue(value: LiquidExpression): string {
  return value.type === NodeTypes.String ? ` '${value.value}'` : '';
}

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

        const eventType = node.args.find(
          (arg): arg is LiquidExpression => arg.type !== NodeTypes.NamedArgument,
        );

        if (eventType && isInvalidStaticValue(eventType, [SUPPORTED_EVENT_TYPE])) {
          context.report({
            message: `Unsupported event type${describeValue(
              eventType,
            )}. The only supported event type is '${SUPPORTED_EVENT_TYPE}'.`,
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
          contextValue &&
          isInvalidStaticValue(contextValue, CONTEXTS_SUPPORTED_BY_ANY_INPUT_TYPE)
        ) {
          context.report({
            message: `Unsupported context${describeValue(
              contextValue,
            )}. Valid values: ${CONTEXTS_SUPPORTED_BY_ANY_INPUT_TYPE.join(
              ', ',
            )}. The '${CONTEXT_ARGUMENT}' argument can also be omitted.`,
            startIndex: contextValue.position.start,
            endIndex: contextValue.position.end,
          });
        }
      },
    };
  },
};
