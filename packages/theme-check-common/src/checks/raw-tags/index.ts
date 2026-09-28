import { isBlock, isSection, isSnippet } from '../../to-schema';
import { Severity, SourceCodeType, type LiquidCheckDefinition } from '../../types';
import type { LiquidRawTag } from '@shopify/liquid-html-parser';

type RawTagName = 'schema' | 'javascript' | 'stylesheet';

interface RawTagCheckOptions {
  tagName: RawTagName;
  code: string;
  message: string;
  url: string;
}

function capitalize(tagName: RawTagName): string {
  return tagName[0].toUpperCase() + tagName.slice(1);
}

function rawTagCheck({ tagName, code, message, url }: RawTagCheckOptions): LiquidCheckDefinition {
  return {
    meta: {
      code,
      name: code,
      docs: {
        description: message,
        recommended: true,
        url,
      },
      type: SourceCodeType.LiquidHtml,
      severity: Severity.ERROR,
      schema: {},
      targets: [],
    },
    create(context) {
      return {
        async LiquidRawTag(node: LiquidRawTag) {
          if (node.name !== tagName) return;

          context.report({
            message,
            startIndex: node.blockStartPosition.start,
            endIndex: node.blockStartPosition.end,
          });
        },
      };
    },
  };
}

function sectionOrBlockOnlyCheck(
  tagName: RawTagName,
  { allowSnippets, url }: { allowSnippets: boolean; url: string },
): LiquidCheckDefinition {
  const locations = allowSnippets ? 'section, block, or snippet' : 'section or block';

  /*
   * Tags that allow snippets use the newer TagInWrongFile naming; schema keeps
   * its original SectionOrBlockOnly code for backwards compatibility.
   */
  const code = `${capitalize(tagName)}${allowSnippets ? 'TagInWrongFile' : 'SectionOrBlockOnly'}`;

  return rawTagCheck({
    tagName,
    code,
    message: `{% ${tagName} %} is only valid in ${locations} files.`,
    url,
  });
}

function oncePerFileCheck(tagName: RawTagName, { url }: { url: string }): LiquidCheckDefinition {
  const code = `${capitalize(tagName)}OncePerFile`;
  const message = `{% ${tagName} %} can only appear once per file.`;

  return {
    meta: {
      code,
      name: code,
      docs: {
        description: message,
        recommended: true,
        url,
      },
      type: SourceCodeType.LiquidHtml,
      severity: Severity.ERROR,
      schema: {},
      targets: [],
    },
    create(context) {
      let count = 0;

      return {
        async LiquidRawTag(node: LiquidRawTag) {
          if (node.name !== tagName) return;

          count += 1;
          if (count === 1) return;

          context.report({
            message,
            startIndex: node.blockStartPosition.start,
            endIndex: node.blockStartPosition.end,
          });
        },
      };
    },
  };
}

function sectionOrBlockOnlyUnlessAllowed(
  tagName: RawTagName,
  { allowSnippets, url }: { allowSnippets: boolean; url: string },
): LiquidCheckDefinition {
  const check = sectionOrBlockOnlyCheck(tagName, { allowSnippets, url });

  return {
    ...check,
    create(context) {
      const uri = context.file.uri;
      if (isSection(uri) || isBlock(uri)) return {};
      if (allowSnippets && isSnippet(uri)) return {};

      return check.create(context);
    },
  };
}

export const SchemaSectionOrBlockOnly = sectionOrBlockOnlyUnlessAllowed('schema', {
  allowSnippets: false,
  url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/schema-section-or-block-only',
});
export const SchemaOncePerFile = oncePerFileCheck('schema', {
  url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/schema-once-per-file',
});
export const JavascriptTagInWrongFile = sectionOrBlockOnlyUnlessAllowed('javascript', {
  allowSnippets: true,
  url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/javascript-tag-in-wrong-file',
});
export const JavascriptOncePerFile = oncePerFileCheck('javascript', {
  url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/javascript-once-per-file',
});
export const StylesheetTagInWrongFile = sectionOrBlockOnlyUnlessAllowed('stylesheet', {
  allowSnippets: true,
  url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/stylesheet-tag-in-wrong-file',
});
export const StylesheetOncePerFile = oncePerFileCheck('stylesheet', {
  url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/stylesheet-once-per-file',
});
