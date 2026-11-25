/**
 * Tag classification constants used by the parser and external consumers.
 */

export const TAGS_WITHOUT_MARKUP = [
  'style',
  'schema',
  'javascript',
  'else',
  'break',
  'continue',
  'comment',
  'raw',
  'doc',
];

export const BLOCKS = [
  'if',
  'unless',
  'for',
  'case',
  'tablerow',
  'capture',
  'form',
  'paginate',
  'block',
  'ifchanged',
  'partial',
];

export const RAW_TAGS = ['raw', 'javascript', 'schema', 'stylesheet', 'style', 'comment', 'doc'];

export const VOID_ELEMENTS = [
  'area',
  'base',
  'br',
  'col',
  'command',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
];

export const HTML_RAW_TAGS = ['script', 'style', 'svg'];
