import { describe, it, expect } from "vitest";
import { check } from "../../check.ts";
import { InMemoryFileSystem } from "../../../tests/parity/in-memory-fs.ts";

const BUTTON_BLOCK = [
  "{% doc %}",
  "  @param {String} [variant] - Button variant",
  "  @param {String} [class] - Additional CSS classes",
  "  @param {String} [url] - Button URL",
  "{% enddoc %}",
  "<button>{{ block.content }}</button>",
].join("\n");

const NO_DOC_BLOCK = "<button>{{ block.content }}</button>";

describe("DuplicateBlockArguments", () => {
  it("reports duplicate argument", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        [
          "file:///templates/test.liquid",
          "{% block 'button', variant: 'a', variant: 'b' %}x{% endblock %}",
        ],
        ["file:///blocks/button.liquid", BUTTON_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const dupes = offenses.filter((o) => o.check === "DuplicateBlockArguments");

    expect(dupes).toHaveLength(1);
    expect(dupes[0].message).toContain("variant");
  });

  it("does not report unique arguments", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        [
          "file:///templates/test.liquid",
          "{% block 'button', variant: 'a', class: 'b' %}x{% endblock %}",
        ],
        ["file:///blocks/button.liquid", BUTTON_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const dupes = offenses.filter((o) => o.check === "DuplicateBlockArguments");

    expect(dupes).toHaveLength(0);
  });

  it("reports duplicate even without a block file", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        [
          "file:///templates/test.liquid",
          "{% block 'nonexistent', variant: 'a', variant: 'b' %}x{% endblock %}",
        ],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const dupes = offenses.filter((o) => o.check === "DuplicateBlockArguments");

    expect(dupes).toHaveLength(1);
    expect(dupes[0].message).toContain("variant");
  });

  it("reports duplicate even when block file has no doc tag", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        [
          "file:///templates/test.liquid",
          "{% block 'button', variant: 'a', variant: 'b' %}x{% endblock %}",
        ],
        ["file:///blocks/button.liquid", NO_DOC_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const dupes = offenses.filter((o) => o.check === "DuplicateBlockArguments");

    expect(dupes).toHaveLength(1);
    expect(dupes[0].message).toContain("variant");
  });
});
