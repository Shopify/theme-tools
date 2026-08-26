import {
  LiquidExpression,
  LiquidFilter,
  LiquidHtmlNode,
  LiquidNamedArgument,
  NodeTypes,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

const FILTER_NAME = 'standard_event_data';
const CONTEXT_ARGUMENT = 'context';
const SUPPORTED_EVENT_TYPE = 'view';

const SUPPORTED_CONTEXTS_BY_DROP: { [drop: string]: string[] } = {
  product: ['page', 'search', 'collection', 'dialog', 'recommendation'],
  cart: ['page', 'dialog'],
};

const DROPS_THAT_IGNORE_CONTEXT = ['collection'];

const CONTEXTS_SUPPORTED_BY_ANY_INPUT_TYPE = [
  ...new Set(Object.values(SUPPORTED_CONTEXTS_BY_DROP).flat()),
];

function isInvalidStaticValue(value: LiquidExpression, supportedValues: string[]): boolean {
  if (value.type === NodeTypes.VariableLookup) return false;
  return value.type !== NodeTypes.String || !supportedValues.includes(value.value);
}

function describeValue(value: LiquidExpression): string {
  return value.type === NodeTypes.String ? ` '${value.value}'` : '';
}

function detectInputDrop(
  node: LiquidFilter,
  parent: LiquidHtmlNode | undefined,
): string | undefined {
  if (parent?.type !== NodeTypes.LiquidVariable) return undefined;
  if (parent.filters[0] !== node) return undefined;

  const expression = parent.expression;
  if (expression.type !== NodeTypes.VariableLookup) return undefined;
  if (expression.lookups.length > 0) return undefined;

  return expression.name ?? undefined;
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
      async LiquidFilter(node, ancestors) {
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

        const drop = detectInputDrop(node, ancestors[ancestors.length - 1]);

        if (drop && DROPS_THAT_IGNORE_CONTEXT.includes(drop)) return;

        const contextArgument = node.args.find(
          (arg): arg is LiquidNamedArgument =>
            arg.type === NodeTypes.NamedArgument && arg.name === CONTEXT_ARGUMENT,
        );
        const contextValue = contextArgument?.value;
        if (!contextValue) return;

        const supportedContexts =
          (drop && SUPPORTED_CONTEXTS_BY_DROP[drop]) || CONTEXTS_SUPPORTED_BY_ANY_INPUT_TYPE;

        if (isInvalidStaticValue(contextValue, supportedContexts)) {
          const dropDescription = drop && SUPPORTED_CONTEXTS_BY_DROP[drop] ? ` for ${drop}` : '';

          context.report({
            message: `Unsupported context${describeValue(
              contextValue,
            )}${dropDescription}. Valid values: ${supportedContexts.join(
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
