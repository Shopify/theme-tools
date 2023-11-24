import {
  HtmlDanglingMarkerClose,
  HtmlElement,
  LiquidBranch,
  LiquidConditionalExpression,
  LiquidExpression,
  LiquidHtmlNode,
  LiquidTag,
  LiquidTagIf,
  NamedTags,
  NodeTypes,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { assertNever, findLast, findLastAndIndex, last } from '../../utils';
import {
  hasAttributeValueOf,
  isAttr,
  isHtmlAttribute,
  isLiquidBranch,
  isNodeOfType,
  isValuedHtmlAttribute,
} from '../utils';

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
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/unclosed-html-element',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const stacksByParent = new Map<LiquidHtmlNode, Stacks>();

    return {
      async HtmlElement(node, ancestors) {
        if (isClosed(node)) return;
        const [branch, index] = findLastAndIndex(ancestors, isLiquidBranch);
        if (!branch) return;

        const parent = ancestors[index - 1];
        const grandparent = ancestors[index - 2];
        if (!parent || !grandparent || parent.type !== NodeTypes.LiquidTag) return;

        if (!stacksByParent.has(grandparent)) {
          stacksByParent.set(grandparent, {
            open: new Map(),
            close: new Map(),
            identifiers: new Set(),
          });
        }
        const stacks = stacksByParent.get(grandparent)!;

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
        // To make typescript happy
        if (!parent || !grandparent || parent.type !== NodeTypes.LiquidTag) return;

        if (!stacksByParent.has(grandparent)) {
          stacksByParent.set(grandparent, {
            open: new Map(),
            close: new Map(),
            identifiers: new Set(),
          });
        }

        const stacks = stacksByParent.get(grandparent)!;
        const identifier = getConditionIdentifier(branch, parent);
        stacks.identifiers.add(identifier);

        if (!stacks.close.has(identifier)) stacks.close.set(identifier, []);
        stacks.close.get(identifier)!.push(node);
      },

      async onCodePathEnd(file) {
        for (const [parentNode, stacks] of stacksByParent) {
          for (const identifier of stacks.identifiers) {
            const openNodes = stacks.open.get(identifier) ?? [];
            const closeNodes = stacks.close.get(identifier) ?? [];

            // if everything is balanced, then open and close should match length and order
            const nodes = ([] as (HtmlElement | HtmlDanglingMarkerClose)[])
              .concat(openNodes, closeNodes)
              .sort((a, b) => a.position.start - b.position.start);
            const stack = [] as (HtmlElement | HtmlDanglingMarkerClose)[];

            for (const node of nodes) {
              if (node.type === NodeTypes.HtmlElement) {
                stack.push(node);
              } else if (stack.length > 0 && getName(node) === getName(stack.at(-1)!)) {
                stack.pop();
              } else {
                stack.push(node);
              }
            }

            for (const node of stack) {
              if (node.type === NodeTypes.HtmlDanglingMarkerClose) {
                context.report({
                  message: `Closing tag does not have a matching opening tag for condition \`${identifier}\` in ${
                    parentNode.type
                  } '${getName(parentNode)}'`,
                  startIndex: node.position.start,
                  endIndex: node.position.end,
                });
              } else {
                context.report({
                  message: `Opening tag does not have a matching closing tag for condition \`${identifier}\` in ${
                    parentNode.type
                  } '${getName(parentNode)}'`,
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
          '??';
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
      return condition.keyword;
    case NodeTypes.Number:
      return condition.value;
    case NodeTypes.VariableLookup:
    case NodeTypes.Range:
      return condition.source.slice(condition.position.start, condition.position.end);
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
