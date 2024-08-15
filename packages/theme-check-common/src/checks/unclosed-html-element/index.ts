import {
  HtmlDanglingMarkerClose,
  HtmlElement,
  LiquidBranch,
  LiquidConditionalExpression,
  LiquidExpression,
  LiquidHtmlNode,
  LiquidTag,
  NamedTags,
  NodeTypes,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { assertNever, findLastAndIndex } from '../../utils';
import { isLiquidBranch } from '../utils';

/** A string representation of a condition */
type ConditionIdentifer = string;

/** A stack of opening tags without their closing tags */
type StacksOpen = Map<ConditionIdentifer, HtmlElement[]>;

/** A stack of close tags without their opening tags */
type StacksClose = Map<ConditionIdentifer, HtmlDanglingMarkerClose[]>;

/**
 * A Stacks is a collection of dangling opened and close nodes
 *   If the code is properly balanced, they match 1:1.
 *   If they do not, then that's an issue with their code!
 */
interface Stacks {
  open: StacksOpen;
  close: StacksClose;
  identifiers: Set<ConditionIdentifer>;
}

export const UnclosedHTMLElement: LiquidCheckDefinition = {
  meta: {
    code: 'UnclosedHTMLElement',
    aliases: ['UnclosedHTMLElement'],
    name: 'Unclosed HTML Element',
    docs: {
      description: 'Warns you of unbalanced HTML tags in branching code',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unclosed-html-element',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    /**
     * Algorithm explanation:
     *
     * When we have unclosed nodes, we have something a bit like this:
     *
     * <grandparent>
     *   {% if condition %}
     *     <unclosed1>
     *   {% else %}
     *     <unclosed2>
     *   {% endif %}
     *
     *   {% if condition %}
     *     </unclosed1>
     *   {% else %}
     *     </unclosed2>
     *   {% endif %}
     * </grandparent>
     *
     * When things are proper, we can see the following:
     *   - unclosed nodes must have the same parent condition,
     *   - unclosed nodes must have the same grandparent node.
     *
     * So what we can do is create stacks of unclosed nodes grouped by
     *   - parent condition, and
     *   - grandparent node.
     *
     * Thus we have
     *   - the stackByGrandparent Map which is the index by grandparent node
     *   - the Stacks object which is a by-condition-identifier index of open/close nodes
     *
     * When we're done with the file, we verify that the stacks push and
     * pop to the empty stack. When it isn't, then we have a problem to
     * report.
     */
    const stacksByGrandparent = new Map<LiquidHtmlNode, Stacks>();

    return {
      async HtmlElement(node, ancestors) {
        if (isClosed(node)) return;
        const [branch, index] = findLastAndIndex(ancestors, isLiquidBranch);
        if (!branch) return;

        const parent = ancestors[index - 1];
        const grandparent = ancestors[index - 2];
        if (!parent || !grandparent || parent.type !== NodeTypes.LiquidTag) return;

        if (!stacksByGrandparent.has(grandparent)) {
          stacksByGrandparent.set(grandparent, {
            open: new Map(),
            close: new Map(),
            identifiers: new Set(),
          });
        }

        const stacks = stacksByGrandparent.get(grandparent)!;
        const identifier = getConditionIdentifier(branch, parent);
        stacks.identifiers.add(identifier);

        if (!stacks.open.has(identifier)) stacks.open.set(identifier, []);
        stacks.open.get(identifier)!.push(node);
      },

      async HtmlDanglingMarkerClose(node, ancestors) {
        const [branch, index] = findLastAndIndex(ancestors, isLiquidBranch);
        if (!branch) return;

        const parent = ancestors[index - 1];
        const grandparent = ancestors[index - 2];
        if (!parent || !grandparent || parent.type !== NodeTypes.LiquidTag) return;

        if (!stacksByGrandparent.has(grandparent)) {
          stacksByGrandparent.set(grandparent, {
            open: new Map(),
            close: new Map(),
            identifiers: new Set(),
          });
        }

        const stacks = stacksByGrandparent.get(grandparent)!;
        const identifier = getConditionIdentifier(branch, parent);
        stacks.identifiers.add(identifier);

        if (!stacks.close.has(identifier)) stacks.close.set(identifier, []);
        stacks.close.get(identifier)!.push(node);
      },

      async onCodePathEnd() {
        for (const [grandparent, stacks] of stacksByGrandparent) {
          for (const identifier of stacks.identifiers) {
            const openNodes = stacks.open.get(identifier) ?? [];
            const closeNodes = stacks.close.get(identifier) ?? [];

            // We sort them in the order they are found in the file because we
            // otherwise don't have an order guarantee with everything running
            // async.
            const nodes = ([] as (HtmlElement | HtmlDanglingMarkerClose)[])
              .concat(openNodes, closeNodes)
              .sort((a, b) => a.position.start - b.position.start);

            // If everything is balanced,
            //   Then we're going to push on open and pop when the close match.
            // If a close doesn't match,
            //   Then we'll push it onto the stack and everything after won't match.
            const stack = [] as (HtmlElement | HtmlDanglingMarkerClose)[];
            for (const node of nodes) {
              if (node.type === NodeTypes.HtmlElement) {
                stack.push(node);
              } else if (
                stack.length > 0 &&
                getName(node) === getName(stack.at(-1)!) &&
                stack.at(-1)!.type === NodeTypes.HtmlElement &&
                node.type === NodeTypes.HtmlDanglingMarkerClose
              ) {
                stack.pop();
              } else {
                stack.push(node);
              }
            }

            // At the end, whatever is left in the stack is a reported offense.
            for (const node of stack) {
              if (node.type === NodeTypes.HtmlDanglingMarkerClose) {
                context.report({
                  message: `Closing tag does not have a matching opening tag for condition \`${identifier}\` in ${
                    grandparent.type
                  } '${getName(grandparent)}'`,
                  startIndex: node.position.start,
                  endIndex: node.position.end,
                });
              } else {
                context.report({
                  message: `Opening tag does not have a matching closing tag for condition \`${identifier}\` in ${
                    grandparent.type
                  } '${getName(grandparent)}'`,
                  startIndex: node.blockStartPosition.start,
                  endIndex: node.blockStartPosition.end,
                });
              }
            }
          }
        }
      },
    };
  },
};

function isClosed(node: HtmlElement) {
  return node.blockEndPosition.start !== node.blockEndPosition.end;
}

function getConditionIdentifier(branch: LiquidBranch, parent: LiquidTag): string {
  if (branch.name === null) {
    switch (parent.name) {
      case NamedTags.if:
        return getConditionIdentifierForMarkup(parent.markup);
      case NamedTags.unless:
        return negateIdentifier(getConditionIdentifierForMarkup(parent.markup));
      default:
        return '??';
    }
  }

  switch (branch.name) {
    case 'else':
      switch (parent.name) {
        case NamedTags.if:
          return negateIdentifier(getConditionIdentifierForMarkup(parent.markup));
        case NamedTags.unless:
          return getConditionIdentifierForMarkup(parent.markup);
        case NamedTags.case:
          return `case ${getConditionIdentifierForMarkup(parent.markup)}`;
        default:
          return '??';
      }
    case NamedTags.elsif:
      return getConditionIdentifierForMarkup(branch.markup);
    case NamedTags.when:
      if (parent.name !== NamedTags.case) return '??';
      return `case ${getConditionIdentifierForMarkup(
        parent.markup,
      )} == ${getConditionIdentifierForWhenMarkup(branch.markup)}`;
    default:
      return '??';
  }
}

function getConditionIdentifierForWhenMarkup(conditions: string | LiquidExpression[]): string {
  if (typeof conditions === 'string') return conditions;
  return conditions.map(getConditionIdentifierForMarkup).join(' or ');
}

function getConditionIdentifierForMarkup(condition: string | LiquidConditionalExpression): string {
  if (typeof condition === 'string') return condition;
  switch (condition.type) {
    case NodeTypes.String:
      return `'` + condition.value + `'`;
    case NodeTypes.LiquidLiteral:
      if (condition.value === null) return 'null';
      return condition.value.toString();
    case NodeTypes.Number:
      return condition.value;
    case NodeTypes.VariableLookup:
      return `${condition.name ?? ''}${condition.lookups.map(
        (expression) => `[${getConditionIdentifierForMarkup(expression)}]`,
      )}`;
    case NodeTypes.Range:
      return `(${getConditionIdentifierForMarkup(
        condition.start,
      )}..${getConditionIdentifierForMarkup(condition.end)})`;
    case NodeTypes.Comparison:
      return [
        getConditionIdentifierForMarkup(condition.left),
        condition.comparator,
        getConditionIdentifierForMarkup(condition.right),
      ].join(' ');
    case NodeTypes.LogicalExpression:
      return [
        getConditionIdentifierForMarkup(condition.left),
        condition.relation,
        getConditionIdentifierForMarkup(condition.right),
      ].join(' ');
    default: {
      return assertNever(condition);
    }
  }
}

function negateIdentifier(conditionIdentifier: ConditionIdentifer): ConditionIdentifer {
  return conditionIdentifier.startsWith('-')
    ? conditionIdentifier.slice(1)
    : `-${conditionIdentifier}`;
}

function getName(node: LiquidHtmlNode) {
  if (node.type === NodeTypes.HtmlElement || node.type === NodeTypes.HtmlDanglingMarkerClose) {
    if (node.name.length === 0) return '';
    return node.source.slice(node.name.at(0)!.position.start, node.name.at(-1)!.position.end);
  } else if (node.type === NodeTypes.LiquidTag) {
    return node.name;
  } else {
    return node.type;
  }
}
