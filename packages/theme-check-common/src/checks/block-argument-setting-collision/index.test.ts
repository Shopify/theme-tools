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

const EMPTY_SCHEMA_BLOCK = ["{% schema %}", "{}", "{% endschema %}"].join("\n");

const NO_SETTINGS_KEY_BLOCK = [
  "{% schema %}",
  '{"name":"Product"}',
  "{% endschema %}",
  "<div>{{ block.content }}</div>",
].join("\n");

const HEADER_ONLY_BLOCK = [
  "{% schema %}",
  '{"settings":[{"type":"header","content":"X"}]}',
  "{% endschema %}",
  "<div>{{ block.content }}</div>",
].join("\n");

async function collisionOffenses(template: string, blockSource?: string) {
  const files = new Map<string, string>([["file:///templates/test.liquid", template]]);
  if (blockSource !== undefined) {
    files.set("file:///blocks/product.liquid", blockSource);
  }

  const fs = new InMemoryFileSystem(files);
  const offenses = await check(["templates/test.liquid"], fs);
  return offenses.filter((o) => o.check === "BlockArgumentSettingCollision");
}

describe("BlockArgumentSettingCollision", () => {
  it("reports a plain arg that collides with a setting id", async () => {
    const offenses = await collisionOffenses(
      "{% block 'product', foo: 'bar' %}x{% endblock %}",
      PRODUCT_BLOCK,
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain("foo");
    expect(offenses[0].message).toContain("block.settings.foo");
  });

  it("does not report a plain arg that is not a setting id", async () => {
    const offenses = await collisionOffenses(
      "{% block 'product', notasetting: 'x' %}x{% endblock %}",
      PRODUCT_BLOCK,
    );

    expect(offenses).toHaveLength(0);
  });

  it("does not report block.settings.* system args", async () => {
    const offenses = await collisionOffenses(
      "{% block 'product', block.settings.foo: 'x' %}x{% endblock %}",
      PRODUCT_BLOCK,
    );

    expect(offenses).toHaveLength(0);
  });

  it("does not report when the block file is missing", async () => {
    const offenses = await collisionOffenses("{% block 'missing', foo: 'x' %}x{% endblock %}");

    expect(offenses).toHaveLength(0);
  });

  it("does not report when the block has no schema", async () => {
    const offenses = await collisionOffenses(
      "{% block 'product', foo: 'x' %}x{% endblock %}",
      NO_SCHEMA_BLOCK,
    );

    expect(offenses).toHaveLength(0);
  });

  it("does not collision-report when the schema has no settings array", async () => {
    const offenses = await collisionOffenses(
      "{% block 'product', foo: 'x' %}x{% endblock %}",
      EMPTY_SCHEMA_BLOCK,
    );

    expect(offenses).toHaveLength(0);
  });

  it("does not collision-report against a schema that omits the settings key", async () => {
    const offenses = await collisionOffenses(
      "{% block 'product', foo: 'x' %}x{% endblock %}",
      NO_SETTINGS_KEY_BLOCK,
    );

    expect(offenses).toHaveLength(0);
  });

  it("does not count header or paragraph entries that lack an id", async () => {
    const offenses = await collisionOffenses(
      "{% block 'product', header_text: 'x' %}x{% endblock %}",
      HEADER_ONLY_BLOCK,
    );

    expect(offenses).toHaveLength(0);
  });

  it("reports each colliding arg", async () => {
    const offenses = await collisionOffenses(
      "{% block 'product', foo: 'a', bar: 'b' %}x{% endblock %}",
      PRODUCT_BLOCK,
    );

    expect(offenses).toHaveLength(2);
  });
});
