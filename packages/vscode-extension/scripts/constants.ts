import { BLOCKS } from "@shopify/liquid-html-parser";

// These HTML elements do not require to be closed (either via </tag> or <tag />)
export const voidElements = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'menuitem',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
];

const BRANCH_TAGS = ['else', 'elsif', 'when'];

export const blockStartTags = BLOCKS;
export const blockEndTags = BLOCKS.map((name) => `end${name}`);
export const increaseIndentTags = BLOCKS.concat(BRANCH_TAGS);
export const decreaseIndentTags = blockEndTags.concat(BRANCH_TAGS);
