import {
  liquidHtmlParser,
  liquidHtmlAstFormat,
  liquidHtmlLanguageName,
} from '~/parser/parser';

export * from '~/parser/stage-2-ast';

export { liquidHtmlLanguageName, liquidHtmlAstFormat };

export const parsers = {
  [liquidHtmlLanguageName]: liquidHtmlParser,
};
