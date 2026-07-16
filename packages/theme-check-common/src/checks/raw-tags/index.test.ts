import { describe, expect, it } from "vitest";
import { check } from "../../check.ts";
import { InMemoryFileSystem } from "../../../tests/parity/in-memory-fs.ts";

const SCHEMA_TAG = "{% schema %}{% endschema %}";
const JAVASCRIPT_TAG = "{% javascript %}{% endjavascript %}";
const STYLESHEET_TAG = "{% stylesheet %}{% endstylesheet %}";

describe("raw tag checks", () => {
  describe("schema", () => {
    it.each(["sections/test.liquid", "blocks/test.liquid"])(
      "allows schema tags in %s",
      async (path) => {
        const fs = new InMemoryFileSystem(new Map([[`file:///${path}`, SCHEMA_TAG]]));

        const offenses = await check([path], fs);

        expect(offenses).toEqual([]);
      },
    );

    it.each(["templates/index.liquid", "snippets/test.liquid"])(
      "reports schema tags in %s",
      async (path) => {
        const fs = new InMemoryFileSystem(new Map([[`file:///${path}`, SCHEMA_TAG]]));

        const offenses = await check([path], fs);

        expect(offenses).toHaveLength(1);
        expect(offenses[0]).toMatchObject({
          check: "schema-section-or-block-only",
          message: "{% schema %} is only valid in section or block files.",
        });
      },
    );

    it("reports second and subsequent schema tags in a file", async () => {
      const source = [SCHEMA_TAG, SCHEMA_TAG, SCHEMA_TAG].join("\n");
      const fs = new InMemoryFileSystem(new Map([["file:///sections/test.liquid", source]]));

      const offenses = await check(["sections/test.liquid"], fs);

      expect(offenses).toHaveLength(2);
      expect(offenses).toEqual([
        expect.objectContaining({
          check: "schema-once-per-file",
          message: "{% schema %} can only appear once per file.",
        }),
        expect.objectContaining({
          check: "schema-once-per-file",
          message: "{% schema %} can only appear once per file.",
        }),
      ]);
    });
  });

  describe("javascript", () => {
    it.each(["sections/test.liquid", "blocks/test.liquid"])(
      "allows javascript tags in %s",
      async (path) => {
        const fs = new InMemoryFileSystem(new Map([[`file:///${path}`, JAVASCRIPT_TAG]]));

        const offenses = await check([path], fs);

        expect(offenses).toEqual([]);
      },
    );

    it.each(["templates/index.liquid", "snippets/test.liquid"])(
      "reports javascript tags in %s",
      async (path) => {
        const fs = new InMemoryFileSystem(new Map([[`file:///${path}`, JAVASCRIPT_TAG]]));

        const offenses = await check([path], fs);

        expect(offenses).toHaveLength(1);
        expect(offenses[0]).toMatchObject({
          check: "javascript-section-or-block-only",
          message: "{% javascript %} is only valid in section or block files.",
        });
      },
    );

    it("reports second and subsequent javascript tags in a file", async () => {
      const source = [JAVASCRIPT_TAG, JAVASCRIPT_TAG, JAVASCRIPT_TAG].join("\n");
      const fs = new InMemoryFileSystem(new Map([["file:///sections/test.liquid", source]]));

      const offenses = await check(["sections/test.liquid"], fs);

      expect(offenses).toHaveLength(2);
      expect(offenses).toEqual([
        expect.objectContaining({
          check: "javascript-once-per-file",
          message: "{% javascript %} can only appear once per file.",
        }),
        expect.objectContaining({
          check: "javascript-once-per-file",
          message: "{% javascript %} can only appear once per file.",
        }),
      ]);
    });
  });

  describe("stylesheet", () => {
    it.each(["sections/test.liquid", "blocks/test.liquid"])(
      "allows stylesheet tags in %s",
      async (path) => {
        const fs = new InMemoryFileSystem(new Map([[`file:///${path}`, STYLESHEET_TAG]]));

        const offenses = await check([path], fs);

        expect(offenses).toEqual([]);
      },
    );

    it.each(["templates/index.liquid", "snippets/test.liquid"])(
      "reports stylesheet tags in %s",
      async (path) => {
        const fs = new InMemoryFileSystem(new Map([[`file:///${path}`, STYLESHEET_TAG]]));

        const offenses = await check([path], fs);

        expect(offenses).toHaveLength(1);
        expect(offenses[0]).toMatchObject({
          check: "stylesheet-section-or-block-only",
          message: "{% stylesheet %} is only valid in section or block files.",
        });
      },
    );

    it("reports second and subsequent stylesheet tags in a file", async () => {
      const source = [STYLESHEET_TAG, STYLESHEET_TAG, STYLESHEET_TAG].join("\n");
      const fs = new InMemoryFileSystem(new Map([["file:///sections/test.liquid", source]]));

      const offenses = await check(["sections/test.liquid"], fs);

      expect(offenses).toHaveLength(2);
      expect(offenses).toEqual([
        expect.objectContaining({
          check: "stylesheet-once-per-file",
          message: "{% stylesheet %} can only appear once per file.",
        }),
        expect.objectContaining({
          check: "stylesheet-once-per-file",
          message: "{% stylesheet %} can only appear once per file.",
        }),
      ]);
    });
  });
});
