import {
  LiquidArgument,
  LiquidExpression,
  LiquidFilter,
  LiquidNamedArgument,
  LiquidNumber,
  LiquidString,
  LiquidVariableLookup,
  NodeTypes,
} from '@shopify/liquid-html-parser';
import { Fixer, LiquidHtmlSuggestion, SourceCodeType } from '../../types';
import { isNodeOfType } from '../utils';

type ImageSize = { width: number; height: number };

type Suggestion = LiquidHtmlSuggestion[] | undefined;

type FitlerParameters = Record<string, number | string | null>;

/**
 * Width and height values cannot exceed this maximum size.
 */
const MAX_SIZE = 5760;

const NAMED_SIZES: Record<string, number> = {
  pico: 16,
  icon: 32,
  thumb: 50,
  small: 100,
  compact: 160,
  medium: 240,
  large: 480,
  grande: 600,
  original: 1024,
};

export function fixHexToRgba(node: LiquidFilter): Fixer<SourceCodeType.LiquidHtml> | undefined {
  /**
   * Cannot fix invalid usage.
   *
   * The `hex_to_rgba` filter is only valid with zero or one argument (`alpha`).
   */
  if (node.args.length > 1) return;

  const { start, end } = getFilterSourceStartAndEnd(node);
  const alpha = getExpressionArgumentValue(node, 0);

  let fixedFilter: string;

  if (alpha) {
    fixedFilter = ` color_to_rgb | color_modify: 'alpha', ${alpha}`;
  } else {
    fixedFilter = ' color_to_rgb';
  }

  return (corrector) => corrector.replace(start, end, fixedFilter);
}

export function suggestImgTagFix(node: LiquidFilter): Suggestion {
  const message = "Replace 'img_tag' with 'image_tag'.";

  const alt = getExpressionArgumentValue(node, 0);
  const cssClass = getExpressionArgumentValue(node, 1);
  const sizeStr = getExpressionArgumentValue(node, 2);

  const { width, height } = getImageSize(sizeStr, { width: -1, height: -1 });
  const { start, end } = getFilterSourceStartAndEnd(node);

  const imageUrlParameters: FitlerParameters = ensureImageValue({ width, height });
  const imageTagParameters: FitlerParameters = {
    width,
    height,
    alt: strValue(alt),
    class: strValue(cssClass),
  };

  const imageUrlFilter = buildFilterString('image_url', imageUrlParameters);
  const imageTagFilter = buildFilterString('image_tag', imageTagParameters);

  return [
    {
      message,
      fix: (corrector) => {
        const insert = `${imageUrlFilter} |${imageTagFilter}`;
        corrector.replace(start, end, insert);
      },
    },
  ];
}

export function suggestImgUrlFix(node: LiquidFilter): Suggestion {
  const message = "Replace 'img_url' with 'image_url'.";

  const cropNode = getNamedArgumentNode(node, 'crop');
  const formatNode = getNamedArgumentNode(node, 'format');
  const scaleNode = getNamedArgumentNode(node, 'scale');
  const sizeStr = getExpressionArgumentValue(node, 0);
  const sizeNode = node.args.at(0);

  /**
   * Cannot fix when 'scale' or 'size' node are variable lookups.
   */
  if (isVariableLookup(scaleNode?.value) || isVariableLookup(sizeNode)) {
    return;
  }

  const { width, height } = ensureImageValue(scaleImage(node, getImageSize(sizeStr)));
  const { start, end } = getFilterSourceStartAndEnd(node);

  const parameters: FitlerParameters = { width, height };

  if (isStringLiteral(cropNode?.value)) {
    parameters['crop'] = strValue(cropNode!.value.value);
  }
  if (isStringLiteral(formatNode?.value)) {
    parameters['format'] = strValue(formatNode!.value.value);
  }
  if (isVariableLookup(formatNode?.value)) {
    parameters['format'] = formatNode!.value.name;
  }

  return [
    {
      message,
      fix: (corrector) => {
        const insert = buildFilterString('image_url', parameters);
        corrector.replace(start, end, insert);
      },
    },
  ];
}

export function suggestImageUrlFix(filter: string, node: LiquidFilter): Suggestion {
  const message = `Replace '${filter}' with 'image_url'.`;
  const sizeStr = getExpressionArgumentValue(node, 0);

  const { width, height } = ensureImageValue(getImageSize(sizeStr));
  const { start, end } = getFilterSourceStartAndEnd(node);

  return [
    {
      message,
      fix: (corrector) => {
        const insert = buildFilterString('image_url', { width, height });
        corrector.replace(start, end, insert);
      },
    },
  ];
}

function getImageSize(size?: string, imageSize = { width: 100, height: 100 }): ImageSize {
  if (!size) return { ...imageSize };

  if (size in NAMED_SIZES) {
    const s = NAMED_SIZES[size];
    return { width: s, height: s };
  }

  const [width, height] = size.split('x').map((s) => parseInt(s));

  return ensureImageSizeLimit({ width, height });
}

function scaleImage(node: LiquidFilter, imageSize: ImageSize): ImageSize {
  const scale = parseInt(getNamedArgumentValue(node, 'scale') || '0') || 1;

  return ensureImageSizeLimit({
    width: imageSize.width * scale,
    height: imageSize.height * scale,
  });
}

function ensureImageSizeLimit(imageSize: ImageSize): ImageSize {
  return {
    width: Math.min(imageSize.width, MAX_SIZE),
    height: Math.min(imageSize.height, MAX_SIZE),
  };
}

function ensureImageValue(imageSize: ImageSize): ImageSize {
  let { width, height } = imageSize;

  const isImageSizeUnset = (!height || height === -1) && (!width || width === -1);

  /**
   * If `image_url` is missing a width or height, we default to width=100, as
   * the documentation mention an error is returned if neither are specified
   * (interestingly, `image_url` doesn't actually fail during runtime tests).
   *
   * That default value is widely mentioned in the documentation and we've
   * confirmed that in runtime tests.
   */
  if (isImageSizeUnset) {
    width = 100;
  }

  return { width, height };
}

function getExpressionArgumentValue(node: LiquidFilter, index: number): string | undefined {
  const arg = node.args.at(index);

  if (isNumberLiteral(arg) || isStringLiteral(arg)) {
    return arg.value;
  }
}

function getNamedArgumentValue(node: LiquidFilter, propertyName: string) {
  const argumentNode = getNamedArgumentNode(node, propertyName);

  const valueNode = argumentNode?.value;

  if (isNumberLiteral(valueNode) || isStringLiteral(valueNode)) {
    return valueNode.value;
  }
}

function getNamedArgumentNode(node: LiquidFilter, argName: string) {
  const args = node.args;

  return args.find(
    (arg): arg is LiquidNamedArgument =>
      isNodeOfType(NodeTypes.NamedArgument, arg) && arg.name === argName,
  );
}

function buildFilterString(filter: string, filterParameters: FitlerParameters) {
  const parameters = Object.entries(filterParameters)
    .filter(([_key, value]) => value && value !== -1)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

  if (!parameters) {
    return ` ${filter}`;
  }

  return ` ${filter}: ${parameters}`;
}

function getFilterSourceStartAndEnd(node: LiquidFilter) {
  const position = node.position;
  const pipePosition = node.source.slice(position.start).indexOf('|');

  return {
    start: position.start + pipePosition + 1,
    end: position.end,
  };
}

function strValue(value?: string) {
  return value ? `'${value}'` : null;
}

function isVariableLookup(exp?: LiquidExpression | LiquidArgument): exp is LiquidVariableLookup {
  return isNodeOfType(NodeTypes.VariableLookup, exp);
}

function isStringLiteral(exp?: LiquidExpression | LiquidArgument): exp is LiquidString {
  return isNodeOfType(NodeTypes.String, exp);
}

function isNumberLiteral(exp?: LiquidExpression | LiquidArgument): exp is LiquidNumber {
  return isNodeOfType(NodeTypes.Number, exp);
}
