import { isSection } from "../../to-schema";

import { basename } from "../../path";
import { isBlock } from "../../to-schema";
import { LiquidCheckDefinition, Severity, SourceCodeType } from "../../types";

export const ValidSectionPresetSettings: LiquidCheckDefinition = {
    meta: {
        code: 'ValidSectionPresetSettings',
        name: 'Enforce valid preset settings for a theme section',
        docs: {
          description: 'This check is aimed at ensuring a valid schema name.',
          recommended: true,
          url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-schema-name',
        },
        type: SourceCodeType.LiquidHtml,
        severity: Severity.ERROR,
        schema: {},
        targets: [],
      },

  create(context) {
    function getSchema() {
        const name = basename(context.file.uri, '.liquid');
        switch (true) {
          case isBlock(context.file.uri):
            return context.getBlockSchema?.(name);
          case isSection(context.file.uri):
            return context.getSectionSchema?.(name);
          default:
            return undefined;
        }
      }
      
    return {
        async RawLiquidTag(node) {
            if (node.name !== 'section') return;
            if (node.name !== 'schema' || node.body.kind !== 'json') {
                return;
              }
      
              const schema = await getSchema();
              if (!schema) return;
              if (schema.validSchema instanceof Error) return;
      
              const validSchema = schema.validSchema; 
                
        }
    };
  },
};
