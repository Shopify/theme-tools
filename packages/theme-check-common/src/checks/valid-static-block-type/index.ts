import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { doesFileExist } from '../../utils/file-utils';
import { isContentForBlock } from '../../utils/markup';

export const ValidStaticBlockType: LiquidCheckDefinition = {
  meta: {
    code: 'ValidStaticBlockType',
    name: 'Prevent use of type that is not valid for static blocks',
    docs: {
      description:
        'This check is aimed at preventing the use of an invalid type for blocks rendered statically.',
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/valid-static-block-type',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const typeRegex = /type:\s*["'](\S+)["']/;

    return {
      async LiquidTag(node) {
        if (node.name !== 'content_for') {
          return;
        }

        if (!isContentForBlock(node.markup)) {
          return;
        }

        const typeValueMatch = typeRegex.exec(node.markup);

        if (typeValueMatch == null) {
          return;
        }
        const [entireTypeTerm, filteredTypeValue] = typeValueMatch;

        const relativePath = `blocks/${filteredTypeValue}.liquid`;
        const fileExists = await doesFileExist(context, relativePath);

        if (!fileExists) {
          const [blockType] = node.markup.split(',');
          const nodeInSource = node.source.substring(node.position.start);
          const contentForBlockStartIndex = nodeInSource.indexOf(blockType);

          const typeParamIndex = typeValueMatch.index + contentForBlockStartIndex;
          const typeParamValueLength = entireTypeTerm.length;

          const typeParamValueEndIndex = typeParamIndex + typeParamValueLength;

          context.report({
            message: `The type '${filteredTypeValue}' is not valid, use a type that exists in the blocks directory`,
            startIndex: node.position.start + typeParamIndex,
            endIndex: node.position.start + typeParamValueEndIndex,
            suggest: [],
          });
        }
      },
    };
  },
};
