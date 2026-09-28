import { describe, expect, it } from 'vitest';
import { DuplicateBlockArguments } from './index';
import { highlightedOffenses, runLiquidCheck } from '../../test';

describe('DuplicateBlockArguments', () => {
  it('reports duplicate arguments after interface sources are merged', async () => {
    const template = "{% block 'card', heading: 'a', heading: 'b' %}{% endblock %}";
    const offenses = await run(template);

    expect(offenses).toMatchObject([
      { message: "Duplicate argument 'heading' in block tag for 'card'." },
    ]);
    expect(highlightedOffenses({ 'templates/test.liquid': template }, offenses)).toEqual([
      "heading: 'b'",
    ]);
  });

  it('does not report unique arguments', async () => {
    const offenses = await run("{% block 'card', heading: 'a', content: body %}{% endblock %}");

    expect(offenses).toEqual([]);
  });

  it.each([
    ['text', "{% block 'card', content: body %}Body{% endblock %}"],
    ['comment', "{% block 'card', content: body %}{% comment %}x{% endcomment %}{% endblock %}"],
  ])('warns that %s body content takes precedence over content:', async (_name, template) => {
    const offenses = await run(template);

    expect(offenses).toMatchObject([
      {
        message:
          "The explicit 'content' argument has no effect because the inline block body takes precedence.",
      },
    ]);
    expect(highlightedOffenses({ 'templates/test.liquid': template }, offenses)).toEqual([
      'content: body',
    ]);
  });

  it('does not let a whitespace-only body override content:', async () => {
    const offenses = await run("{% block 'card', content: body %}\n  \t\n{% endblock %}");

    expect(offenses).toEqual([]);
  });

  it('preserves the duplicate warning when body content also overrides content:', async () => {
    const offenses = await run(
      "{% block 'card', content: first, content: second %}Body{% endblock %}",
    );

    expect(offenses.map((offense) => offense.message)).toEqual([
      "The explicit 'content' argument has no effect because the inline block body takes precedence.",
      "Duplicate argument 'content' in block tag for 'card'.",
      "The explicit 'content' argument has no effect because the inline block body takes precedence.",
    ]);
  });

  it('reports duplicates without resolving the target block', async () => {
    const offenses = await run("{% block 'missing', value: 'a', value: 'b' %}{% endblock %}");

    expect(offenses).toHaveLength(1);
  });
});

async function run(template: string) {
  return runLiquidCheck(DuplicateBlockArguments, template, 'templates/test.liquid');
}
