import type {
  LiquidBranch,
  LiquidConditionalExpression,
  LiquidExpression,
  LiquidTag,
} from '@shopify/liquid-html-parser';
import type { Context } from '.';
import {
  conditionalHasBareArrayAccess,
  hasBareArrayAccess,
  hasSkippedCharacters,
  hasSkippedPrefixCharacters,
  hasUnclosedQuotedString,
} from './utils';

const ELSIF_BARE_ARRAY_ACCESS = 'Bare bracket access is not allowed in strict2 mode';

export function checkBranchTag(node: LiquidBranch, context: Context): void {
  if (node.name === 'elsif') {
    checkElsifBranch(node, context);
    return;
  }

  if (node.name === 'when') {
    checkWhenBranch(node, context);
  }
}

export function checkMisplacedBranchTag(node: LiquidTag, context: Context): void {
  context.report({
    message: `Unknown tag '${node.name}'`,
    startIndex: node.position.start,
    endIndex: node.position.end,
  });
}

function checkWhenBranch(node: LiquidBranch, context: Context): void {
  if (typeof node.markup === 'string') {
    reportWhenSyntaxError(node, context);
    return;
  }

  const markup = node.markup as LiquidExpression[];
  const rawMarkup = node.source.slice(node.markupPosition.start, node.markupPosition.end);

  if (hasUnclosedQuotedString(rawMarkup)) {
    reportWhenSyntaxError(node, context);
    return;
  }

  if (markup.some(hasBareArrayAccess)) {
    context.report({
      message: 'Bare bracket access is not allowed',
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
    return;
  }

  if (markup.length === 0) {
    return;
  }

  const parsedMarkup = node.source.slice(markup[0].position.start, node.markupPosition.end);
  if (hasSkippedCharacters(parsedMarkup)) {
    reportWhenSyntaxError(node, context);
  }
}

function reportWhenSyntaxError(node: LiquidBranch, context: Context): void {
  context.report({
    message: "Syntax error in 'when' tag",
    startIndex: node.blockStartPosition.start,
    endIndex: node.blockStartPosition.end,
  });
}

function checkElsifBranch(node: LiquidBranch, context: Context): void {
  if (typeof node.markup === 'string') {
    reportSyntaxError(node, context);
    return;
  }

  const markup = node.markup as LiquidConditionalExpression;
  const rawMarkup = node.source.slice(node.markupPosition.start, node.markupPosition.end);

  if (hasUnclosedQuotedString(rawMarkup)) {
    reportSyntaxError(node, context);
    return;
  }

  if (conditionalHasBareArrayAccess(markup)) {
    context.report({
      message: ELSIF_BARE_ARRAY_ACCESS,
      startIndex: node.blockStartPosition.start,
      endIndex: node.blockStartPosition.end,
    });
    return;
  }

  if (hasSkippedPrefixCharacters(node.source, node.markupPosition.start, markup.position.start)) {
    reportSyntaxError(node, context);
    return;
  }

  const parsedMarkup = node.source.slice(markup.position.start, node.markupPosition.end);
  if (hasSkippedCharacters(parsedMarkup)) {
    reportSyntaxError(node, context);
  }
}

function reportSyntaxError(node: LiquidBranch, context: Context): void {
  context.report({
    message: "Syntax error in 'elsif' tag",
    startIndex: node.blockStartPosition.start,
    endIndex: node.blockStartPosition.end,
  });
}
