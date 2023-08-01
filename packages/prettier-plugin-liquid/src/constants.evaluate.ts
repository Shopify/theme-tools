// This code is adapted from prettier/src/language-html/constants.evaluate.js
const htmlStyles: any = require('html-styles');

const getCssStyleTags = (property: string) =>
  Object.fromEntries(
    htmlStyles
      .filter((htmlStyle: any) => htmlStyle.style[property])
      .flatMap((htmlStyle: any) =>
        htmlStyle.selectorText
          .split(',')
          .map((selector: any) => selector.trim())
          .filter((selector: any) => /^[\dA-Za-z]+$/.test(selector))
          .map((tagName: any) => [tagName, htmlStyle.style[property]]),
      ),
  );

export const CSS_DISPLAY_TAGS: Record<string, string> = {
  ...getCssStyleTags('display'),

  // TODO: send PR to upstream
  button: 'inline-block',

  // special cases for some css display=none elements
  template: 'inline',
  source: 'block',
  track: 'block',
  script: 'block',
  param: 'block',

  // `noscript` is inline
  // noscript: "inline",

  // there's no css display for these elements but they behave these ways
  details: 'block',
  summary: 'block',
  dialog: 'block',
  meter: 'inline-block',
  progress: 'inline-block',
  object: 'inline-block',
  video: 'inline-block',
  audio: 'inline-block',
  select: 'inline-block',
  option: 'block',
  optgroup: 'block',
};

export const CSS_DISPLAY_LIQUID_TAGS: Record<string, string> = {
  // control flow tags
  if: 'inline',
  unless: 'inline',
  else: 'inline',
  elsif: 'inline',
  case: 'inline',
  when: 'inline',

  // iteration tags,
  for: 'inline',
  cycle: 'inline',
  tablerow: 'block',
  break: 'none',
  continue: 'none',

  // theme tags
  comment: 'none',
  echo: 'inline',
  form: 'block',
  layout: 'none',
  liquid: 'inline',
  paginate: 'inline',
  raw: 'inline',
  render: 'inline',
  include: 'inline',
  section: 'block',
  style: 'none',

  // variable tags
  assign: 'none',
  capture: 'inline',
  increment: 'inline',
  decrement: 'inline',
};

export const CSS_DISPLAY_LIQUID_DEFAULT = 'inline';

export const CSS_DISPLAY_DEFAULT = 'inline';
export const CSS_WHITE_SPACE_TAGS: Record<string, string> =
  getCssStyleTags('white-space');
export const CSS_WHITE_SPACE_DEFAULT = 'normal';

export const CSS_WHITE_SPACE_LIQUID_TAGS: Record<string, string> = {
  capture: 'pre',
  raw: 'pre',
};
