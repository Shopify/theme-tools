import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { getSchema, isSection } from '../../to-schema';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export const DiscourageSectionBlocks: LiquidCheckDefinition = {
  meta: {
    code: 'DiscourageSectionBlocks',
    name: 'Discourage Section Blocks',
    docs: {
      description: 'Discourages the use of section blocks in favor of theme blocks.',
      recommended: false,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    if (!isSection(context.file.uri)) {
      return {};
    }

    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const schema = await getSchema(context);
        const { ast, validSchema } = schema ?? {};

        if (!ast || ast instanceof Error || !validSchema || validSchema instanceof Error) {
          return;
        }

        const offset = node.blockStartPosition.end;
        validSchema.blocks?.forEach((block, index) => {
          if (!('settings' in block)) {
            return;
          }

          const astNode = nodeAtPath(ast, ['blocks', String(index), 'type']);
          if (!astNode) {
            return;
          }

          context.report({
            message: 'Consider using a ThemeBlock instead of a SectionBlock.',
            startIndex: offset + getLocStart(astNode),
            endIndex: offset + getLocEnd(astNode),
          });
        });
      },
    };
  },
};
