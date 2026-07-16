import { describe, it, expect } from "vitest";
import { check } from "../../check.ts";
import { InMemoryFileSystem } from "../../../tests/parity/in-memory-fs.ts";

const CARD_BLOCK = [
  "{% doc %}",
  "  @param {String} title - Card title",
  "  @param {String} [subtitle] - Card subtitle",
  "{% enddoc %}",
  "<div>{{ title }}</div>",
].join("\n");

const NO_DOC_BLOCK = "<button>{{ block.content }}</button>";

describe("MissingBlockArguments", () => {
  it("reports when required param is missing", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        ["file:///templates/test.liquid", "{% block 'card', subtitle: 'sub' %}x{% endblock %}"],
        ["file:///blocks/card.liquid", CARD_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const missing = offenses.filter((o) => o.check === "MissingBlockArguments");

    expect(missing).toHaveLength(1);
    expect(missing[0].message).toContain("title");
  });

  it("does not report when required param is provided", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        ["file:///templates/test.liquid", "{% block 'card', title: 'Hello' %}x{% endblock %}"],
        ["file:///blocks/card.liquid", CARD_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const missing = offenses.filter((o) => o.check === "MissingBlockArguments");

    expect(missing).toHaveLength(0);
  });

  it("does not report when block file has no doc tag", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        ["file:///templates/test.liquid", "{% block 'card' %}x{% endblock %}"],
        ["file:///blocks/card.liquid", NO_DOC_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const missing = offenses.filter((o) => o.check === "MissingBlockArguments");

    expect(missing).toHaveLength(0);
  });

  it("does not report when block file does not exist", async () => {
    const fs = new InMemoryFileSystem(
      new Map([["file:///templates/test.liquid", "{% block 'missing' %}x{% endblock %}"]]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const missing = offenses.filter((o) => o.check === "MissingBlockArguments");

    expect(missing).toHaveLength(0);
  });
});
