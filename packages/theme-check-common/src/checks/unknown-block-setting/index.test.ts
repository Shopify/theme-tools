import { describe, it, expect } from "vitest";
import { check } from "../../check.ts";
import { InMemoryFileSystem } from "../../../tests/parity/in-memory-fs.ts";

const PRODUCT_BLOCK = [
  "{% schema %}",
  '{"settings":[{"id":"foo","type":"text"},{"id":"bar","type":"text"}]}',
  "{% endschema %}",
  "<div>{{ block.content }}</div>",
].join("\n");

const NO_SCHEMA_BLOCK = "<div>{{ block.content }}</div>";

const EMPTY_SETTINGS_BLOCK = [
  "{% schema %}",
  '{"settings":[]}',
  "{% endschema %}",
  "<div>{{ block.content }}</div>",
].join("\n");

const NO_SETTINGS_KEY_BLOCK = [
  "{% schema %}",
  '{"name":"Product"}',
  "{% endschema %}",
  "<div>{{ block.content }}</div>",
].join("\n");

async function unknownSettingOffenses(template: string, blockSource?: string) {
  const files = new Map<string, string>([["file:///templates/test.liquid", template]]);
  if (blockSource !== undefined) {
    files.set("file:///blocks/product.liquid", blockSource);
  }

  const fs = new InMemoryFileSystem(files);
  const offenses = await check(["templates/test.liquid"], fs);
  return offenses.filter((o) => o.check === "UnknownBlockSetting");
}

describe("UnknownBlockSetting", () => {
  it("reports a block.settings.<name> that is not a setting id", async () => {
    const offenses = await unknownSettingOffenses(
      "{% block 'product', block.settings.baz: 'x' %}x{% endblock %}",
      PRODUCT_BLOCK,
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain("baz");
  });

  it("does not report a known setting", async () => {
    const offenses = await unknownSettingOffenses(
      "{% block 'product', block.settings.foo: 'x' %}x{% endblock %}",
      PRODUCT_BLOCK,
    );

    expect(offenses).toHaveLength(0);
  });

  it("does not report a plain (non-system) arg", async () => {
    const offenses = await unknownSettingOffenses(
      "{% block 'product', baz: 'x' %}x{% endblock %}",
      PRODUCT_BLOCK,
    );

    expect(offenses).toHaveLength(0);
  });

  it("does not report block.content or block.name", async () => {
    const offenses = await unknownSettingOffenses(
      "{% block 'product', block.content: c, block.name: 'n' %}x{% endblock %}",
      PRODUCT_BLOCK,
    );

    expect(offenses).toHaveLength(0);
  });

  it("does not report a nested path (owned by the syntax-error layer)", async () => {
    const offenses = await unknownSettingOffenses(
      "{% block 'product', block.settings.foo.bar: 'x' %}x{% endblock %}",
      PRODUCT_BLOCK,
    );

    expect(offenses).toHaveLength(0);
  });

  it("does not report an empty setting suffix", async () => {
    const offenses = await unknownSettingOffenses(
      "{% block 'product', block.settings.: 'x' %}x{% endblock %}",
      PRODUCT_BLOCK,
    );

    expect(offenses).toHaveLength(0);
  });

  it("does not report when the block file is missing", async () => {
    const offenses = await unknownSettingOffenses(
      "{% block 'missing', block.settings.baz: 'x' %}x{% endblock %}",
    );

    expect(offenses).toHaveLength(0);
  });

  it("does not report when the block has no schema", async () => {
    const offenses = await unknownSettingOffenses(
      "{% block 'product', block.settings.baz: 'x' %}x{% endblock %}",
      NO_SCHEMA_BLOCK,
    );

    expect(offenses).toHaveLength(0);
  });

  it("reports against an explicit empty settings array", async () => {
    const offenses = await unknownSettingOffenses(
      "{% block 'product', block.settings.baz: 'x' %}x{% endblock %}",
      EMPTY_SETTINGS_BLOCK,
    );

    expect(offenses).toHaveLength(1);
  });

  it("reports against a schema that omits the settings key", async () => {
    const offenses = await unknownSettingOffenses(
      "{% block 'product', block.settings.baz: 'x' %}x{% endblock %}",
      NO_SETTINGS_KEY_BLOCK,
    );

    expect(offenses).toHaveLength(1);
  });

  it("reports each unknown setting", async () => {
    const offenses = await unknownSettingOffenses(
      "{% block 'product', block.settings.baz: 'a', block.settings.qux: 'b' %}x{% endblock %}",
      PRODUCT_BLOCK,
    );

    expect(offenses).toHaveLength(2);
  });
});
