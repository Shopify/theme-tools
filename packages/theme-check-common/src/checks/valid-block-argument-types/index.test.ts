import { describe, it, expect } from "vitest";
import { check } from "../../check.ts";
import { InMemoryFileSystem } from "../../../tests/parity/in-memory-fs.ts";

const BUTTON_BLOCK = [
  "{% doc %}",
  "  @param {String} [variant] - Button variant",
  "  @param {String} [class] - Additional CSS classes",
  "  @param {String} [url] - Button URL",
  "  @param {Number} [count] - Item count",
  "{% enddoc %}",
  "<button>{{ block.content }}</button>",
].join("\n");

const NO_DOC_BLOCK = "<button>{{ block.content }}</button>";

describe("ValidBlockArgumentTypes", () => {
  it("reports type mismatch", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        ["file:///templates/test.liquid", "{% block 'button', variant: 42 %}x{% endblock %}"],
        ["file:///blocks/button.liquid", BUTTON_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const types = offenses.filter((o) => o.check === "ValidBlockArgumentTypes");

    expect(types).toHaveLength(1);
    expect(types[0].message).toContain("variant");
    expect(types[0].message).toContain("String");
    expect(types[0].message).toContain("number");
  });

  it("does not report correct types", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        [
          "file:///templates/test.liquid",
          "{% block 'button', variant: 'primary' %}x{% endblock %}",
        ],
        ["file:///blocks/button.liquid", BUTTON_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const types = offenses.filter((o) => o.check === "ValidBlockArgumentTypes");

    expect(types).toHaveLength(0);
  });

  it("does not report variable lookups", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        ["file:///templates/test.liquid", "{% block 'button', variant: my_var %}x{% endblock %}"],
        ["file:///blocks/button.liquid", BUTTON_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const types = offenses.filter((o) => o.check === "ValidBlockArgumentTypes");

    expect(types).toHaveLength(0);
  });

  it("does not report when block file has no doc tag", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        ["file:///templates/test.liquid", "{% block 'button', variant: 42 %}x{% endblock %}"],
        ["file:///blocks/button.liquid", NO_DOC_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const types = offenses.filter((o) => o.check === "ValidBlockArgumentTypes");

    expect(types).toHaveLength(0);
  });

  it("reports type mismatch for a Number param", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        ["file:///templates/test.liquid", "{% block 'button', count: 'abc' %}x{% endblock %}"],
        ["file:///blocks/button.liquid", BUTTON_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const types = offenses.filter((o) => o.check === "ValidBlockArgumentTypes");

    expect(types).toHaveLength(1);
    expect(types[0].message).toContain("count");
    expect(types[0].message).toContain("Number");
    expect(types[0].message).toContain("string");
  });

  it("does not report when block file does not exist", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        ["file:///templates/test.liquid", "{% block 'missing', count: 42 %}x{% endblock %}"],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const types = offenses.filter((o) => o.check === "ValidBlockArgumentTypes");

    expect(types).toHaveLength(0);
  });
});
