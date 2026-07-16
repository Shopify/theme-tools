import { toLiquidHtmlAST } from "@editor/liquid-html-parser";
import {
  check as themeCheck,
  Severity,
  SourceCodeType,
  type Config,
  type Dependencies,
  type LiquidSourceCode,
  type Offense,
} from "@shopify/theme-check-common";
import { describe, expect, it } from "vitest";
import { check } from "../../check.ts";
import { InMemoryFileSystem } from "../../../tests/parity/in-memory-fs.ts";
import { ExcessiveSettingsCount, TOLERATED_SETTINGS_COUNT } from "./index.ts";

const ROOT_URI = "file:///";
const DEFAULT_PATH = "sections/test.liquid";
const DEFAULT_URI = ROOT_URI + DEFAULT_PATH;

function toSourceCode(uri: string, source: string): LiquidSourceCode {
  let ast: ReturnType<typeof toLiquidHtmlAST> | Error;

  try {
    ast = toLiquidHtmlAST(source);
  } catch (error) {
    ast = error instanceof Error ? error : new Error(String(error));
  }

  return {
    uri,
    source,
    type: SourceCodeType.LiquidHtml,
    ast: ast as LiquidSourceCode["ast"],
  };
}

async function checkWithMaxSettings(template: string, maxSettings: number): Promise<Offense[]> {
  const fs = new InMemoryFileSystem(new Map([[DEFAULT_URI, template]]));
  const config: Config = {
    context: "theme",
    settings: {
      ExcessiveSettingsCount: { maxSettings } as unknown as Config["settings"][string],
    },
    checks: [ExcessiveSettingsCount],
    rootUri: ROOT_URI,
  };
  const dependencies: Dependencies = { fs };

  return themeCheck([toSourceCode(DEFAULT_URI, template)], config, dependencies);
}

function settingEntries(
  count: number,
  { indent = "    ", idPrefix = "setting", labelPrefix = "Setting " } = {},
): string[] {
  return Array.from({ length: count }, (_, index) => {
    const separator = index === count - 1 ? "" : ",";

    return `${indent}{ "type": "text", "id": "${idPrefix}_${index}", "label": "${labelPrefix}${index}" }${separator}`;
  });
}

function schemaWithSettings(count: number): string {
  return [
    "<div>section</div>",
    "{% schema %}",
    "{",
    '  "name": "Test",',
    '  "settings": [',
    ...settingEntries(count),
    "  ]",
    "}",
    "{% endschema %}",
  ].join("\n");
}

describe("ExcessiveSettingsCount", () => {
  describe("wrapper tolerated maximum", () => {
    it("does not report at the tolerated maximum", async () => {
      const fs = new InMemoryFileSystem(
        new Map([[DEFAULT_URI, schemaWithSettings(TOLERATED_SETTINGS_COUNT)]]),
      );

      const offenses = await check([DEFAULT_PATH], fs);

      expect(offenses.filter((offense) => offense.check === "ExcessiveSettingsCount")).toEqual([]);
    });

    it("reports when settings exceed the tolerated maximum", async () => {
      const fs = new InMemoryFileSystem(
        new Map([[DEFAULT_URI, schemaWithSettings(TOLERATED_SETTINGS_COUNT + 1)]]),
      );

      const offenses = await check([DEFAULT_PATH], fs);
      const own = offenses.filter((offense) => offense.check === "ExcessiveSettingsCount");

      expect(own).toHaveLength(1);
      expect(own[0]).toMatchObject({ severity: Severity.WARNING });
      expect(own[0].message).toBe(
        `This schema declares ${TOLERATED_SETTINGS_COUNT + 1} settings, which exceeds the maximum of ${TOLERATED_SETTINGS_COUNT}. Consider splitting this section or block into smaller pieces, or grouping related options with a header.`,
      );
    });
  });

  it("reports when count exceeds a custom maximum", async () => {
    const offenses = await checkWithMaxSettings(schemaWithSettings(3), 2);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      `This schema declares 3 settings, which exceeds the maximum of 2. Consider splitting this section or block into smaller pieces, or grouping related options with a header.`,
    );
  });

  it("does not report when count equals the configured maximum", async () => {
    await expect(checkWithMaxSettings(schemaWithSettings(40), 40)).resolves.toEqual([]);
  });

  it("excludes header and paragraph entries that have no id", async () => {
    const template = [
      "<div>section</div>",
      "{% schema %}",
      "{",
      '  "settings": [',
      '    { "type": "header", "content": "Group" },',
      '    { "type": "text", "id": "a", "label": "A" },',
      '    { "type": "paragraph", "content": "Note" },',
      '    { "type": "text", "id": "b", "label": "B" },',
      '    { "type": "text", "id": "c", "label": "C" }',
      "  ]",
      "}",
      "{% endschema %}",
    ].join("\n");

    await expect(checkWithMaxSettings(template, 3)).resolves.toEqual([]);
  });

  it("ignores settings nested in blocks", async () => {
    const blockSettings = settingEntries(20, {
      indent: "        ",
      idPrefix: "nested",
      labelPrefix: "N",
    });
    const template = [
      "<div>section</div>",
      "{% schema %}",
      "{",
      '  "settings": [',
      ...settingEntries(5),
      "  ],",
      '  "blocks": [',
      "    {",
      '      "type": "child",',
      '      "settings": [',
      ...blockSettings,
      "      ]",
      "    }",
      "  ]",
      "}",
      "{% endschema %}",
    ].join("\n");

    await expect(checkWithMaxSettings(template, 6)).resolves.toEqual([]);
  });

  it("reports above the threshold and not at the threshold", async () => {
    const over = await checkWithMaxSettings(schemaWithSettings(6), 5);
    expect(over).toHaveLength(1);

    const atBoundary = await checkWithMaxSettings(schemaWithSettings(5), 5);
    expect(atBoundary).toEqual([]);
  });

  it("does not report when schema is absent", async () => {
    await expect(checkWithMaxSettings("<div>{{ product.title }}</div>", 1)).resolves.toEqual([]);
  });
});
