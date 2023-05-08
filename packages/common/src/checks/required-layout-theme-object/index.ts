// src/checks/required-layout-theme-object/index.ts
import {
  LiquidCheckDefinition,
  LiquidHtmlNodeTypes as NodeTypes,
  LiquidHtmlNodeOfType as NodeOfType,
  Severity,
  SourceCodeType,
} from '../../types';
import { isHtmlTag } from '../utils';

type VariableLookup = NodeOfType<NodeTypes.VariableLookup>;

export const RequiredLayoutThemeObject: LiquidCheckDefinition = {
  meta: {
    code: 'RequiredLayoutThemeObject',
    name: 'Prevent missing required objects in theme.liquid',
    docs: {
      description:
        'This check prevents missing {{ content_for_header }} and {{ content_for_layout }} objects in layout/theme.liquid.',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    if (context.relativePath(context.file.absolutePath) !== 'layout/theme.liquid') {
      return {};
    }

    const requiredObjects = ['content_for_header', 'content_for_layout'];
    const foundObjects: Set<string> = new Set();
    let headTagEndPosition: number | null = null;
    let bodyTagEndPosition: number | null = null;

    function checkVariableUsage(node: VariableLookup) {
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
          headTagEndPosition = node.blockEndPosition.start - 1;
        } else if (isHtmlTag(node, 'body')) {
          bodyTagEndPosition = node.blockEndPosition.start - 1;
        }
      },

      async onCodePathEnd() {
        for (const requiredObject of requiredObjects) {
          if (!foundObjects.has(requiredObject)) {
            const message = `The required object '{{ ${requiredObject} }}' is missing in layout/theme.liquid`;
            const fixInsertPosition =
              requiredObject === 'content_for_header' ? headTagEndPosition : bodyTagEndPosition;

            context.report({
              message,
              startIndex: 0,
              endIndex: 0,
              fix:
                fixInsertPosition !== null
                  ? (corrector) => corrector.insert(fixInsertPosition, `{{ ${requiredObject} }}`)
                  : undefined,
            });
          }
        }
      },
    };
  },
};
