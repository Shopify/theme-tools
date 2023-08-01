import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { ContentForHeaderModification } from './index';

describe('Module: ContentForHeaderModification', () => {
  it('reports a offense with the use of a filter', async () => {
    const sourceCode = "{{ content_for_header | split: ',' }}";

    const offenses = await runLiquidCheck(ContentForHeaderModification, sourceCode);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual('Do not rely on the content of `content_for_header`');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
  });

  it('reports offense with the use of assign', async () => {
    const sourceCode = '{% assign x = content_for_header %}';

    const offenses = await runLiquidCheck(ContentForHeaderModification, sourceCode);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual('Do not rely on the content of `content_for_header`');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual(['{% assign x = content_for_header %}']);
  });

  it('reports offense with the use of capture', async () => {
    const sourceCode = `
      {% capture x %}
        {{ content_for_header }}
      {% endcapture %}
    `;

    const offenses = await runLiquidCheck(ContentForHeaderModification, sourceCode);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual('Do not rely on the content of `content_for_header`');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual(['{{ content_for_header }}']);
  });

  it('reports offense with the use of echo', async () => {
    const sourceCode = `
      {% liquid
        echo content_for_header | split: ','
      %}
    `;

    const offenses = await runLiquidCheck(ContentForHeaderModification, sourceCode);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual('Do not rely on the content of `content_for_header`');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual(["echo content_for_header | split: ','"]);
  });

  it('does not report an offense with normal use', async () => {
    const sourceCode = '{{ content_for_header }}';

    const offenses = await runLiquidCheck(ContentForHeaderModification, sourceCode);
    expect(offenses).toHaveLength(0);
    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toHaveLength(0);
  });
});
