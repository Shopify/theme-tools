import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export const UniqueStaticBlockId: LiquidCheckDefinition = {
  meta: {
    code: 'UniqueStaticBlockId',
    name: 'Prevent use of duplicated ids for blocks rendered statically',
    docs: {
      description:
        'This check is aimed at preventing the use of duplicated ids for blocks rendered statically.',
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/unique-static-block-id',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const usedIds: Set<string> = new Set();
    const idRegex = /id:\s*["'](\S+)["']/;
    return {
      async LiquidTag(node) {
        if (node.name !== 'content_for') {
          return;
        }

        const [blockType] = node.markup.split(',');

        if (blockType.replace(/["']/g, '') !== 'block') {
          return;
        }

        const idValueMatch = idRegex.exec(node.markup);

        if (idValueMatch == null) {
          return;
        }

        const [entireIdTerm, filteredIdValue] = idValueMatch;

        if (usedIds.has(filteredIdValue)) {
          const nodeInSource = node.source.substring(node.position.start);
          const contentForBlockStartIndex = nodeInSource.indexOf(blockType);

          const idParamIndex = idValueMatch.index + contentForBlockStartIndex;
          const idParamValueLength = entireIdTerm.length;

          const idParamValueEndIndex = idParamIndex + idParamValueLength;

          context.report({
            message: `The id '${filteredIdValue}' is already being used by another static block`,
            startIndex: node.position.start + idParamIndex,
            endIndex: node.position.start + idParamValueEndIndex,
            suggest: [],
          });
        } else {
          usedIds.add(filteredIdValue);
        }
      },
    };
  },
};
