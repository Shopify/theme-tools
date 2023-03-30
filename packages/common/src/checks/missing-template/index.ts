import {
  LiquidTagSection,
  RenderMarkup,
  LiquidTag,
  LiquidTagNamed,
} from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import { NamedTags, NodeTypes } from '@shopify/prettier-plugin-liquid/dist/types';
import { LiquidCheckDefinition, Severity, SourceCode, SourceCodeType } from '../../types';

function isNamedLiquidTag(tag: LiquidTag): tag is LiquidTagNamed {
  return typeof tag.markup !== 'string';
}

export const MissingTemplate: LiquidCheckDefinition = {
  meta: {
    code: 'MissingTemplate',
    name: 'Avoid rendering missing templates',
    docs: {
      description: 'Reports missing include/render/section liquid file',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const renderMarkupsPerFile = new Map<
      string,
      { file: SourceCode<SourceCodeType.LiquidHtml>; nodes: RenderMarkup[] }
    >();
    const sectionsPerFile = new Map<
      string,
      { file: SourceCode<SourceCodeType.LiquidHtml>; nodes: LiquidTagSection[] }
    >();

    return {
      async onCodePathStart(file) {
        renderMarkupsPerFile.set(file.relativePath, { file, nodes: [] });
        sectionsPerFile.set(file.relativePath, { file, nodes: [] });
      },

      async RenderMarkup(node, file) {
        renderMarkupsPerFile.get(file.relativePath)!.nodes.push(node);
      },

      async LiquidTag(node, file) {
        if (!isNamedLiquidTag(node)) {
          return;
        }

        if (node.name !== NamedTags.section) {
          return;
        }

        sectionsPerFile.get(file.relativePath)!.nodes.push(node);
      },

      async onEnd() {
        for (let [_, { file, nodes }] of renderMarkupsPerFile) {
          nodes.forEach((node) => {
            if (node.snippet.type === NodeTypes.VariableLookup) {
              return;
            }

            const path = `${node.snippet.value}.liquid`;
            if (renderMarkupsPerFile.has(`/snippets/${path}`)) {
              return;
            }

            context.report(file, {
              message: `'${path}' is not found`,
              startIndex: node.snippet.position.start,
              endIndex: node.snippet.position.end,
            });
          });
        }

        for (let [_, { file, nodes }] of sectionsPerFile) {
          nodes.forEach((node) => {
            const path = `${node.markup.value}.liquid`;
            if (sectionsPerFile.has(`sections/${path}`)) {
              return;
            }

            context.report(file, {
              message: `'${path}' is not found`,
              startIndex: node.markup.position.start,
              endIndex: node.markup.position.end,
            });
          });
        }
      },
    };
  },
};
