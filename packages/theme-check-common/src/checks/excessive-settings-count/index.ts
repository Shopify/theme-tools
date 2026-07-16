import {
  isArrayNode,
  isObjectNode,
  SchemaProp,
  Severity,
  SourceCodeType,
  toJSONAST,
  visit,
  type LiquidCheckDefinition,
} from "@shopify/theme-check-common";
import { type LiquidRawTag } from "@editor/liquid-html-parser";

/**
 * 40 sits just above Horizon's per-file maximum of 36 top-level settings,
 * mirroring LiquidNestingDepth: the default rests a small step above the
 * largest healthy theme so well-formed sections and blocks never trip it.
 *
 * +------------+-------+
 * | Theme      | Count |
 * +------------+-------+
 * | base-theme | 9     |
 * | Dawn       | 23    |
 * | Horizon    | 36    |
 * +------------+-------+
 *
 * Measured:
 *   - Dawn       9ccdacf81f175c7caeebc28348e50bcb02ef8fc7
 *   - Horizon    70c27a8050f66d653c4d30a3974ff07d919e4310
 *   - base-theme 31b1e1c (ose-next-theme)
 */
export const TOLERATED_SETTINGS_COUNT = 40;

const schema = {
  maxSettings: SchemaProp.number(TOLERATED_SETTINGS_COUNT),
};

export const ExcessiveSettingsCount: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: "ExcessiveSettingsCount",
    name: "ExcessiveSettingsCount",
    docs: {
      description:
        "Reports section or block schemas that declare more top-level settings than the configured maximum.",
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema,
    targets: [],
  },

  create(context) {
    const maxSettings = context.settings.maxSettings;

    return {
      async onCodePathEnd() {
        if (context.file.ast instanceof Error) return;

        const schemaNode = visit<SourceCodeType.LiquidHtml, LiquidRawTag>(context.file.ast, {
          LiquidRawTag(node) {
            if (node.name === "schema") return node;
          },
        })[0];
        if (!schemaNode) return;

        const schemaAst = toJSONAST(schemaNode.body.value);
        if (schemaAst instanceof Error || !isObjectNode(schemaAst)) return;

        const settingsProperty = schemaAst.children.find(
          (property) => property.key.value === "settings",
        );
        if (!settingsProperty || !isArrayNode(settingsProperty.value)) return;

        /*
         * Count only top-level settings that carry an id. Presentation-only
         * entries such as header and paragraph have no id and are skipped,
         * and settings nested inside blocks or presets are authored
         * separately, so they are not folded into this file's count.
         */
        const settingsCount = settingsProperty.value.children.filter(
          (setting) =>
            isObjectNode(setting) &&
            setting.children.some((property) => property.key.value === "id"),
        ).length;

        if (settingsCount <= maxSettings) return;

        context.report({
          message: `This schema declares ${settingsCount} settings, which exceeds the maximum of ${maxSettings}. Consider splitting this section or block into smaller pieces, or grouping related options with a header.`,
          startIndex: schemaNode.blockStartPosition.start,
          endIndex: schemaNode.blockStartPosition.end,
        });
      },
    };
  },
};
