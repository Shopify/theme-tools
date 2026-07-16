import {
  isBlock,
  isSection,
  Severity,
  SourceCodeType,
  type LiquidCheckDefinition,
} from "@shopify/theme-check-common";
import type { LiquidRawTag } from "@editor/liquid-html-parser";

type RawTagName = "schema" | "javascript" | "stylesheet";

interface RawTagCheckOptions {
  tagName: RawTagName;
  code: string;
  message: string;
}

function rawTagCheck({ tagName, code, message }: RawTagCheckOptions): LiquidCheckDefinition {
  return {
    meta: {
      code,
      name: code,
      docs: {
        description: message,
        recommended: true,
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

function sectionOrBlockOnlyCheck(tagName: RawTagName): LiquidCheckDefinition {
  return rawTagCheck({
    tagName,
    code: `${tagName}-section-or-block-only`,
    message: `{% ${tagName} %} is only valid in section or block files.`,
  });
}

function oncePerFileCheck(tagName: RawTagName): LiquidCheckDefinition {
  const code = `${tagName}-once-per-file`;
  const message = `{% ${tagName} %} can only appear once per file.`;

  return {
    meta: {
      code,
      name: code,
      docs: {
        description: message,
        recommended: true,
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

function sectionOrBlockOnlyUnlessAllowed(tagName: RawTagName): LiquidCheckDefinition {
  const check = sectionOrBlockOnlyCheck(tagName);

  return {
    ...check,
    create(context) {
      if (isSection(context.file.uri) || isBlock(context.file.uri)) return {};

      return check.create(context);
    },
  };
}

export const SchemaSectionOrBlockOnly = sectionOrBlockOnlyUnlessAllowed("schema");
export const SchemaOncePerFile = oncePerFileCheck("schema");
export const JavascriptSectionOrBlockOnly = sectionOrBlockOnlyUnlessAllowed("javascript");
export const JavascriptOncePerFile = oncePerFileCheck("javascript");
export const StylesheetSectionOrBlockOnly = sectionOrBlockOnlyUnlessAllowed("stylesheet");
export const StylesheetOncePerFile = oncePerFileCheck("stylesheet");
