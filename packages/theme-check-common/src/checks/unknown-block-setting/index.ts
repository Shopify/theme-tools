import { Severity, SourceCodeType, type LiquidCheckDefinition } from '../../types';
import type { BlockMarkup } from '@shopify/liquid-html-parser';
import { getBlockSchemaSettings } from '../common/block-schema';

const PREFIX = 'block.settings.';

export const UnknownBlockSetting: LiquidCheckDefinition = {
  meta: {
    code: 'UnknownBlockSetting',
    name: 'Unknown Block Setting',
    docs: {
      description:
        "Reports a block.settings.<name> argument in a block tag where <name> is not a setting id in the target block's schema.",
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidTag(node) {
        if (node.name !== 'block') return;
        if (typeof node.markup === 'string') return;

        const markup = node.markup as BlockMarkup;
        const blockName = markup.name.value;
        const settings = await getBlockSchemaSettings(context, blockName);
        if (!settings) return;

        for (const arg of markup.args) {
          if (!arg.name.startsWith(PREFIX)) continue;

          const settingId = arg.name.slice(PREFIX.length);
          if (settingId.length === 0) continue;
          if (settingId.includes('.')) continue;
          if (settings.has(settingId)) continue;

          context.report({
            message: `Unknown setting '${settingId}' referenced via 'block.settings.${settingId}' on block '${blockName}'.`,
            startIndex: arg.position.start,
            endIndex: arg.position.end,
          });
        }
      },
    };
  },
};
