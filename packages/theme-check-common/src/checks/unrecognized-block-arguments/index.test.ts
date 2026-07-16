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

describe("UnrecognizedBlockArguments", () => {
  it("reports unknown argument", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        [
          "file:///templates/test.liquid",
          "{% block 'button', variant: 'primary', size: 'large' %}x{% endblock %}",
        ],
        ["file:///blocks/button.liquid", BUTTON_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const unknown = offenses.filter((o) => o.check === "UnrecognizedBlockArguments");

    expect(unknown).toHaveLength(1);
    expect(unknown[0].message).toContain("size");
  });

  it("does not report known arguments", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        [
          "file:///templates/test.liquid",
          "{% block 'button', variant: 'primary', class: 'mb-2' %}x{% endblock %}",
        ],
        ["file:///blocks/button.liquid", BUTTON_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const unknown = offenses.filter((o) => o.check === "UnrecognizedBlockArguments");

    expect(unknown).toHaveLength(0);
  });

  it("does not report system arguments", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        [
          "file:///templates/test.liquid",
          "{% block 'button', block.settings.variant: 'xl', block.content: content %}x{% endblock %}",
        ],
        ["file:///blocks/button.liquid", BUTTON_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const unknown = offenses.filter((o) => o.check === "UnrecognizedBlockArguments");

    expect(unknown).toHaveLength(0);
  });

  it("does not report when block file has no doc tag", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        ["file:///templates/test.liquid", "{% block 'button', unknown: 'val' %}x{% endblock %}"],
        ["file:///blocks/button.liquid", NO_DOC_BLOCK],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const unknown = offenses.filter((o) => o.check === "UnrecognizedBlockArguments");

    expect(unknown).toHaveLength(0);
  });

  it("does not report when block file does not exist", async () => {
    const fs = new InMemoryFileSystem(
      new Map([
        ["file:///templates/test.liquid", "{% block 'missing', foo: 'bar' %}x{% endblock %}"],
      ]),
    );

    const offenses = await check(["templates/test.liquid"], fs);
    const unknown = offenses.filter((o) => o.check === "UnrecognizedBlockArguments");

    expect(unknown).toHaveLength(0);
  });
});
