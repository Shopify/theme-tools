import { ContentForMarkup } from '@shopify/liquid-html-parser';

export function isContentForBlock(
  nodeMarkup: string | ContentForMarkup,
): nodeMarkup is ContentForMarkup {
  if (typeof nodeMarkup === 'string') {
    return false;
  }
  return nodeMarkup.contentForType.value === 'block';
}
