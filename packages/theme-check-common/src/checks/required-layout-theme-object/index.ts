import { ConfigTarget, Severity, SourceCodeType, type LiquidCheckDefinition } from '../../types';
import { type HtmlElement, type LiquidVariableLookup } from '@shopify/liquid-html-parser';
import { isHtmlTag } from '../utils';

const LAYOUT_PATH_PATTERN = /^layout\/[^/]+\.liquid$/i;

/**
 * Copied from ../../types's RequiredLayoutThemeObject.
 *
 * When @editor/theme-check-common and @shopify/theme-check-common are merged,
 * merge this fork back into the upstream check instead of keeping two
 * layout-object implementations.
 */
export const RequiredLayoutThemeObject: LiquidCheckDefinition = {
  meta: {
    code: 'RequiredLayoutThemeObject',
    name: 'Prevent missing required objects in theme.liquid',
    docs: {
      description:
        'This check prevents missing {{ content_for_header }} and {{ content_for_layout }} objects in layout/theme.liquid.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/required-layout-theme-object',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [ConfigTarget.All, ConfigTarget.Recommended],
  },

  create(context) {
    /**
     * @editor/theme-check-common runs this upstream check for every layout
     * asset, not only layout/theme.liquid. Merge this scope difference back
     * into @shopify/theme-check-common when the packages are unified.
     */
    if (!LAYOUT_PATH_PATTERN.test(context.toRelativePath(context.file.uri))) {
      return {};
    }

    const requiredObjects = ['content_for_header', 'content_for_layout'];
    const foundObjects: Set<string> = new Set();
    let headTag: HtmlElement | undefined;
    let bodyTag: HtmlElement | undefined;

    function checkVariableUsage(node: LiquidVariableLookup) {
      if (node.name && requiredObjects.includes(node.name)) {
        foundObjects.add(node.name);
      }
    }

    return {
      async VariableLookup(node) {
        checkVariableUsage(node);
      },

      async HtmlElement(node) {
        if (isHtmlTag(node, 'head')) {
          headTag = node;
        } else if (isHtmlTag(node, 'body')) {
          bodyTag = node;
        }
      },

      async onCodePathEnd() {
        for (const requiredObject of requiredObjects) {
          if (!foundObjects.has(requiredObject)) {
            const message = `The required object '{{ ${requiredObject} }}' is missing in layout/theme.liquid`;
            const insertionNode = requiredObject === 'content_for_header' ? headTag : bodyTag;
            const fixInsertPosition = insertionNode?.blockEndPosition.start;

            context.report({
              message,
              startIndex: insertionNode?.position.start ?? 0,
              endIndex: insertionNode?.position.end ?? 0,
              fix:
                fixInsertPosition !== undefined
                  ? (corrector) => corrector.insert(fixInsertPosition, `{{ ${requiredObject} }}`)
                  : undefined,
            });
          }
        }
      },
    };
  },
};
