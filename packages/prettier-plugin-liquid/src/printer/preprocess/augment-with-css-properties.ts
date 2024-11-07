import { NodeTypes } from '@shopify/liquid-html-parser';
import {
  CSS_DISPLAY_DEFAULT,
  CSS_DISPLAY_LIQUID_DEFAULT,
  CSS_DISPLAY_LIQUID_TAGS,
  CSS_DISPLAY_TAGS,
  CSS_WHITE_SPACE_DEFAULT,
  CSS_WHITE_SPACE_LIQUID_TAGS,
  CSS_WHITE_SPACE_TAGS,
} from '../../constants.evaluate';
import {
  LiquidParserOptions,
  Augment,
  AugmentedNode,
  WithCssProperties,
  WithSiblings,
} from '../../types';
import { assertNever } from '../../utils';

function getCssDisplayFromComment(body: string) {
  return body.match(/^\s*display:\s*([a-z]+)\s*$/)?.[1];
}

function getCssWhitespaceFromComment(body: string) {
  return body.match(/^\s*white-?space:\s*([a-z]+)\s*$/)?.[1];
}

function getCssDisplay(node: AugmentedNode<WithSiblings>, options: LiquidParserOptions): string {
  if (node.prev && node.prev.type === NodeTypes.HtmlComment) {
    // <!-- display: block -->
    const cssDisplay = getCssDisplayFromComment(node.prev.body);
    if (cssDisplay) {
      return cssDisplay;
    }
  }

  if (node.prev && node.prev.type === NodeTypes.LiquidTag && node.prev.name === '#') {
    // {% # display: block %}
    const cssDisplay = getCssDisplayFromComment(node.prev.markup);
    if (cssDisplay) {
      return cssDisplay;
    }
  }

  switch (node.type) {
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlDanglingMarkerClose:
    case NodeTypes.HtmlSelfClosingElement: {
      switch (options.htmlWhitespaceSensitivity) {
        case 'strict':
          return 'inline';
        case 'ignore':
          return 'block';
        default: {
          return (
            (node.name.length === 1 &&
              node.name[0].type === NodeTypes.TextNode &&
              CSS_DISPLAY_TAGS[node.name[0].value]) ||
            CSS_DISPLAY_DEFAULT
          );
        }
      }
    }

    case NodeTypes.HtmlVoidElement:
    case NodeTypes.HtmlRawNode: {
      switch (options.htmlWhitespaceSensitivity) {
        case 'strict':
          return 'inline';
        case 'ignore':
          return 'block';
        default: {
          return CSS_DISPLAY_TAGS[node.name] || CSS_DISPLAY_DEFAULT;
        }
      }
    }

    case NodeTypes.RawMarkup:
    case NodeTypes.TextNode:
      return 'inline';

    case NodeTypes.LiquidTag:
    case NodeTypes.LiquidRawTag:
      switch (options.htmlWhitespaceSensitivity) {
        case 'strict':
          return 'inline';
        case 'ignore':
          return 'block';
        default: {
          return CSS_DISPLAY_LIQUID_TAGS[node.name] || CSS_DISPLAY_LIQUID_DEFAULT;
        }
      }

    case NodeTypes.LiquidBranch:
    case NodeTypes.LiquidVariableOutput:
      return 'inline';

    case NodeTypes.AttrDoubleQuoted:
    case NodeTypes.AttrSingleQuoted:
    case NodeTypes.AttrUnquoted:
    case NodeTypes.AttrEmpty:
      return 'inline';

    case NodeTypes.HtmlDoctype:
    case NodeTypes.HtmlComment:
      return 'block';

    case NodeTypes.Document:
      return 'block';

    case NodeTypes.YAMLFrontmatter:
      return 'block';

    case NodeTypes.LiquidVariable:
    case NodeTypes.LiquidFilter:
    case NodeTypes.NamedArgument:
    case NodeTypes.LiquidLiteral:
    case NodeTypes.String:
    case NodeTypes.Number:
    case NodeTypes.Range:
    case NodeTypes.VariableLookup:
    case NodeTypes.AssignMarkup:
    case NodeTypes.CycleMarkup:
    case NodeTypes.ContentForMarkup:
    case NodeTypes.ForMarkup:
    case NodeTypes.PaginateMarkup:
    case NodeTypes.RenderMarkup:
    case NodeTypes.RenderVariableExpression:
    case NodeTypes.LogicalExpression:
    case NodeTypes.Comparison:
      return 'should not be relevant';

    default:
      return assertNever(node);
  }
}

function getNodeCssStyleWhiteSpace(
  node: AugmentedNode<WithSiblings>,
  options: LiquidParserOptions,
): string {
  if (node.prev && node.prev.type === NodeTypes.HtmlComment) {
    // <!-- white-space: normal -->
    const whitespace = getCssWhitespaceFromComment(node.prev.body);
    if (whitespace) {
      return whitespace;
    }
  }

  if (node.prev && node.prev.type === NodeTypes.LiquidTag && node.prev.name === '#') {
    // {% # white-space: normal %}
    const whitespace = getCssWhitespaceFromComment(node.prev.markup);
    if (whitespace) {
      return whitespace;
    }
  }

  switch (node.type) {
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlDanglingMarkerClose:
    case NodeTypes.HtmlSelfClosingElement: {
      return (
        (node.name.length === 1 &&
          node.name[0].type === NodeTypes.TextNode &&
          CSS_WHITE_SPACE_TAGS[node.name[0].value]) ||
        CSS_WHITE_SPACE_DEFAULT
      );
    }

    case NodeTypes.HtmlVoidElement:
    case NodeTypes.HtmlRawNode: {
      return CSS_WHITE_SPACE_TAGS[node.name] || CSS_WHITE_SPACE_DEFAULT;
    }

    case NodeTypes.TextNode:
      return CSS_WHITE_SPACE_DEFAULT;

    case NodeTypes.RawMarkup:
    case NodeTypes.YAMLFrontmatter:
    case NodeTypes.LiquidRawTag:
      return 'pre';

    case NodeTypes.LiquidTag:
      switch (node.name) {
        case 'capture': {
          switch (options.captureWhitespaceSensitivity) {
            case 'strict':
              return 'pre';
            case 'ignore':
              return 'normal';
            default: {
              throw assertNever(options.captureWhitespaceSensitivity);
            }
          }
        }

        default: {
          return CSS_WHITE_SPACE_LIQUID_TAGS[node.name] || CSS_WHITE_SPACE_DEFAULT;
        }
      }

    case NodeTypes.LiquidBranch:
    case NodeTypes.LiquidVariableOutput:
      return CSS_WHITE_SPACE_DEFAULT;

    case NodeTypes.AttrDoubleQuoted:
    case NodeTypes.AttrSingleQuoted:
    case NodeTypes.AttrUnquoted:
    case NodeTypes.AttrEmpty:
      return CSS_WHITE_SPACE_DEFAULT;

    case NodeTypes.HtmlDoctype:
    case NodeTypes.HtmlComment:
      return CSS_WHITE_SPACE_DEFAULT;

    case NodeTypes.Document:
      return CSS_WHITE_SPACE_DEFAULT;

    case NodeTypes.LiquidVariable:
    case NodeTypes.LiquidFilter:
    case NodeTypes.NamedArgument:
    case NodeTypes.LiquidLiteral:
    case NodeTypes.String:
    case NodeTypes.Number:
    case NodeTypes.Range:
    case NodeTypes.VariableLookup:
    case NodeTypes.AssignMarkup:
    case NodeTypes.CycleMarkup:
    case NodeTypes.ContentForMarkup:
    case NodeTypes.ForMarkup:
    case NodeTypes.PaginateMarkup:
    case NodeTypes.RenderMarkup:
    case NodeTypes.RenderVariableExpression:
    case NodeTypes.LogicalExpression:
    case NodeTypes.Comparison:
      return 'should not be relevant';

    default:
      return assertNever(node);
  }
}

export const augmentWithCSSProperties: Augment<WithSiblings> = (options, node) => {
  const augmentations: WithCssProperties = {
    cssDisplay: getCssDisplay(node, options),
    cssWhitespace: getNodeCssStyleWhiteSpace(node, options),
  };

  Object.assign(node, augmentations);
};
