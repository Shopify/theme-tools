import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { CaptureOnContentForBlock } from './index';

describe('Module: ContentForHeaderModification', () => {
  it('reports offense with the use of capture', async () => {
    const sourceCode = `
      {% capture x %}
        {% content_for "block", type: "text", id:"static-block-id" %}
      {% endcapture %}
    `;

    const offenses = await runLiquidCheck(CaptureOnContentForBlock, sourceCode);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual('Do not capture `content_for "block"`');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual(['{% content_for "block", type: "text", id:"static-block-id" %}']);
  });

  it('does not report an offense with normal use', async () => {
    const sourceCode = '{% content_for "block", type: "text", id:"static-block-id" %}';

    const offenses = await runLiquidCheck(CaptureOnContentForBlock, sourceCode);
    expect(offenses).toHaveLength(0);
    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toHaveLength(0);
  });

  it('does not report an offense with content_for "blocks"', async () => {
    const sourceCode = `
      {% capture x %}
        {% content_for "blocks" %}
      {% endcapture %}
    `;

    const offenses = await runLiquidCheck(CaptureOnContentForBlock, sourceCode);
    expect(offenses).toHaveLength(0);
    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toHaveLength(0);
  });
});
