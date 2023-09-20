import {
  HtmlRawNode,
  LiquidFilter,
  LiquidVariable,
  LiquidVariableOutput,
} from '@shopify/liquid-html-parser';
import { LiquidHtmlSuggestion } from '../../types';
import { last } from '../../utils';

const suggestionMessage = (attr: 'defer' | 'async') =>
  `Use an HTML script tag with the ${attr} attribute instead`;

export const liquidFilterSuggestion = (
  attr: 'defer' | 'async',
  node: LiquidFilter,
  parentNode: LiquidVariable,
  grandParentNode: LiquidVariableOutput,
): LiquidHtmlSuggestion => ({
  message: suggestionMessage(attr),
  fix(corrector) {
    const expression = node.source.slice(
      parentNode.expression.position.start,
      last(parentNode.filters, -1)?.position.end ?? node.position.start,
    );
    const url = `{{ ${expression} }}`;
    corrector.replace(
      grandParentNode.position.start,
      grandParentNode.position.end,
      `<script src="${url}" ${attr}></script>`,
    );
  },
});

export const scriptTagSuggestion = (
  attr: 'defer' | 'async',
  node: HtmlRawNode,
): LiquidHtmlSuggestion => ({
  message: suggestionMessage(attr),
  fix(corrector) {
    corrector.insert(node.blockStartPosition.end - 1, ` ${attr}`);
  },
});
