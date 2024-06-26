import { isRegExp } from 'lodash-es';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

interface BlockPreset {
  type: string;
  id?: string;
  static?: string;
}
interface BlockPresetDetail extends BlockPreset {
  presetName: string;
  startIndex: number;
  endIndex: number;
}
export const ValidStaticBlockPreset: LiquidCheckDefinition = {
  meta: {
    code: 'ValidStaticBlockPreset',
    name: 'Prevent static block preset definitions that do not match any content_for "block" definitions',
    docs: {
      description:
        'This check is aimed at preventing the creation of static block presets that do not have corresponding content_block "block" with the same id and type',
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/valid-static-block-preset',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const typeRegex = /type:\s*["'](\S+)["']/;
    const idRegex = /id:\s*["'](\S+)["']/;
    const staticBlockTypeByIds = new Map<string, string>();
    const blockPresets = new Array<BlockPresetDetail>();

    return {
      async onCodePathEnd() {
        blockPresets.forEach((blockPreset: BlockPresetDetail) => {
          if (blockPreset.static && blockPreset.id) {
            const staticBlockType = staticBlockTypeByIds.get(blockPreset.id);

            if (staticBlockType !== blockPreset.type) {
              context.report({
                message: `The block preset with ID '${blockPreset.id}' in '${blockPreset.presetName}' does not have corresponding content_for "block" reference in the code`,
                startIndex: blockPreset.startIndex,
                endIndex: blockPreset.endIndex,
              });
            }
          }
        });
      },
      async LiquidRawTag(node) {
        if (node.name == 'schema') {
          const jsonSchema = node.source.slice(
            node.blockStartPosition.end,
            node.blockEndPosition.start,
          );

          const parsedSchema = await JSON.parse(jsonSchema);
          if (parsedSchema && parsedSchema.presets) {
            parsedSchema.presets.flatMap((preset: any) => {
              preset.blocks &&
                preset.blocks.forEach((blockPreset: BlockPreset) => {
                  blockPresets.push({
                    startIndex: node.blockStartPosition.end,
                    endIndex: node.blockEndPosition.start,
                    presetName: preset.name,
                    ...blockPreset,
                  });
                });
            });
          }
        }
      },
      async LiquidTag(node) {
        if (node.name == 'content_for') {
          const [blockType] = node.markup.split(',');

          if (blockType.replace(/["']/g, '') !== 'block') {
            return;
          }

          const typeValueMatch = typeRegex.exec(node.markup);
          const idRegexMatch = idRegex.exec(node.markup);

          if (typeValueMatch == null || idRegexMatch == null) {
            return;
          }
          const [entireTypeTerm, filteredTypeValue] = typeValueMatch;
          const [entireIdTerm, filteredIdValue] = idRegexMatch;

          staticBlockTypeByIds.set(filteredIdValue, filteredTypeValue);
        }
      },
    };
  },
};
