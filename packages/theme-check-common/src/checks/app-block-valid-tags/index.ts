import { LiquidRawTag, LiquidTag } from '@shopify/liquid-html-parser';
import { ConfigTarget, LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export enum ForbiddenTag {
  JavaScript = 'javascript',
  StyleSheet = 'stylesheet',
  Include = 'include',
  Layout = 'layout',
  Section = 'section',
  Sections = 'sections',
}

const isForbiddenTag = (value: string): value is ForbiddenTag => {
  return Object.values(ForbiddenTag).includes(value as ForbiddenTag);
};

const buildErrorMessage = (tag: ForbiddenTag) =>
  `Theme app extension blocks cannot contain '${tag}' tags`;

export const AppBlockValidTags: LiquidCheckDefinition = {
  meta: {
    code: 'AppBlockValidTags',
    name: 'App Block Valid Tags',
    docs: {
      description:
        'Identifies forbidden Liquid tags in theme app extension app block and app embed block code.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/app-block-valid-tags',
      recommended: false,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [ConfigTarget.ThemeAppExtension],
  },

  create(context) {
    const handleForbiddenTags = async (node: LiquidTag | LiquidRawTag) => {
      if (isForbiddenTag(node.name)) {
        // When a forbidden tag is used to define a block section
        // with an end tag, highlight the whole section
        const endIndex = node.blockEndPosition ? node.blockEndPosition.end : node.position.end;
        const startIndex = node.blockStartPosition.start;
        const message = buildErrorMessage(node.name);

        return context.report({ message, startIndex, endIndex });
      }
    };

    return {
      LiquidRawTag: handleForbiddenTags,
      LiquidTag: handleForbiddenTags,
    };
  },
};
