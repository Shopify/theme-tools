import { describe, expect, it } from "vitest";
import { check } from "../../check.ts";
import { InMemoryFileSystem } from "../../../tests/parity/in-memory-fs.ts";

const KILOBYTE = 1024;
const MEGABYTE = 1024 * KILOBYTE;

type FileLimitCase = {
  key: string;
  path: string;
  limitBytes: number;
};

/* prettier-ignore */ /// ignoring Prettier here to keep comments readable.
const FILE_LIMIT_CASES: FileLimitCase[] = [
  { key: "assets",                      path: "assets/theme.css",                 limitBytes: 20 * MEGABYTE },
  { key: "blocks",                      path: "blocks/product-card.liquid",       limitBytes: 256 * KILOBYTE },
  { key: "config/settings_data.json",   path: "config/settings_data.json",        limitBytes: 1.5 * MEGABYTE },
  { key: "config/settings_schema.json", path: "config/settings_schema.json",      limitBytes: 512 * KILOBYTE },
  { key: "config",                      path: "config/markets.json",              limitBytes: 256 * KILOBYTE },
  { key: "layout",                      path: "layout/theme.liquid",              limitBytes: 256 * KILOBYTE },
  { key: "snippets",                    path: "snippets/card.liquid",             limitBytes: 256 * KILOBYTE },
  { key: "templates/*.json",            path: "templates/product.json",           limitBytes: 512 * KILOBYTE },
  { key: "templates",                   path: "templates/product.liquid",         limitBytes: 256 * KILOBYTE },
  { key: "locales",                     path: "locales/en.default.json",          limitBytes: 1.5 * MEGABYTE },
  { key: "sections/*.json",             path: "sections/product.json",            limitBytes: 512 * KILOBYTE },
  { key: "sections",                    path: "sections/product.liquid",          limitBytes: 256 * KILOBYTE },
];

describe("MaxFileSize", () => {
  it.each(FILE_LIMIT_CASES)(
    "accepts $key at the exact byte limit",
    async ({ path, limitBytes }) => {
      const offenses = await lint(path, sourceWithByteSize(path, limitBytes));

      expect(offenses).toEqual([]);
    },
  );

  it.each(FILE_LIMIT_CASES)(
    "reports $key one byte over the limit",
    async ({ path, limitBytes }) => {
      const offenses = await lint(path, sourceWithByteSize(path, limitBytes + 1));

      expect(offenses).toHaveLength(1);
      expect(offenses[0]).toMatchObject({
        check: "MaxFileSize",
        uri: `file:///${path}`,
        message: expect.stringContaining(`the limit is ${formatBytes(limitBytes)}`),
      });
    },
  );

  it("reports oversized files under a VFS-prefixed theme path", async () => {
    const path = "workspace/themes/123/templates/index.liquid";
    const offenses = await lint(path, "a".repeat(256 * KILOBYTE + 1));

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      check: "MaxFileSize",
      uri: `file:///${path}`,
      message: expect.stringContaining("the limit is 256 KB"),
    });
  });

  it("excludes schema block bytes for template-table files", async () => {
    const source =
      "a".repeat(256 * KILOBYTE) +
      "{% schema %}" +
      JSON.stringify({
        name: "Large schema",
        settings: [{ type: "textarea", id: "copy", label: "Copy", default: "b".repeat(KILOBYTE) }],
      }) +
      "{% endschema %}";

    const offenses = await lint("sections/schema-test.liquid", source);

    expect(offenses).toEqual([]);
  });

  it("excludes whitespace-controlled schema block bytes for template-table files", async () => {
    const source =
      "a".repeat(256 * KILOBYTE) +
      "{%- schema -%}" +
      JSON.stringify({
        name: "Large schema",
        settings: [{ type: "textarea", id: "copy", label: "Copy", default: "b".repeat(KILOBYTE) }],
      }) +
      "{%- endschema -%}";

    const offenses = await lint("sections/schema-whitespace-control-test.liquid", source);

    expect(offenses).toEqual([]);
  });

  it.each(["_drafts/bfcm/templates/product.json", "_drafts/bfcm/sections/product.json"])(
    "ignores oversized draft file %s",
    async (path) => {
      const offenses = await lint(path, jsonWithByteSize(20 * MEGABYTE + 1));

      expect(offenses).toEqual([]);
    },
  );

  it("measures UTF-8 bytes instead of JavaScript string length", async () => {
    const source = "é".repeat(128 * KILOBYTE + 1);

    expect(source.length).toBeLessThan(256 * KILOBYTE);
    expect(Buffer.byteLength(source)).toBeGreaterThan(256 * KILOBYTE);

    const offenses = await lint("snippets/multibyte.liquid", source);

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      check: "MaxFileSize",
      message: expect.stringContaining("262146 bytes"),
    });
  });

  it("reports oversized files even when the Liquid parser cannot build an AST", async () => {
    const source = "a".repeat(256 * KILOBYTE + 1) + "{% raw %}";

    const offenses = await lint("snippets/broken.liquid", source);

    expect(offenses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check: "MaxFileSize",
          uri: "file:///snippets/broken.liquid",
          message: expect.stringContaining("the limit is 256 KB"),
        }),
      ]),
    );
  });
});

async function lint(path: string, source: string) {
  const fs = new InMemoryFileSystem(new Map([[`file:///${path}`, source]]));
  return check([path], fs);
}

function sourceWithByteSize(path: string, bytes: number): string {
  if (path === "layout/theme.liquid") {
    const layoutSource =
      "<html><head>{{ content_for_header }}</head><body>{{ content_for_layout }}</body></html>";
    return layoutSource + "a".repeat(bytes - Buffer.byteLength(layoutSource));
  }

  if (path === "config/settings_schema.json") {
    return jsonArrayWithByteSize(bytes);
  }

  if (path.endsWith(".json")) {
    return jsonWithByteSize(bytes);
  }

  return "a".repeat(bytes);
}

function jsonArrayWithByteSize(bytes: number): string {
  // Wrapping the object form in `[]` adds exactly 2 bytes.
  return `[${jsonWithByteSize(bytes - 2)}]`;
}

function jsonWithByteSize(bytes: number): string {
  // Build {"d":"aaa..."} where the filler length is adjusted to hit the exact byte target.
  const shell = '{"d":""}'; // 8 bytes
  const filler = "a".repeat(bytes - shell.length);
  return `{"d":"${filler}"}`;
}

function formatBytes(bytes: number): string {
  if (bytes % MEGABYTE === 0) {
    return `${bytes / MEGABYTE} MB`;
  }

  if (bytes % KILOBYTE === 0) {
    return `${bytes / KILOBYTE} KB`;
  }

  return `${bytes} bytes`;
}
