import { describe, it, expect } from 'vitest';
import { runLiquidCheck } from '../../test';
import { UniqueStaticBlockId } from './index';

describe('Module: UniqueStaticBlockId', () => {
  it('should report an error when two static blocks have the same id', async () => {
    const sourceCode = `
     {% content_for "block", type: "text", id: "static-block" %}
     {% content_for "block", type: "text", id: "static-block" %}
    `;

    const offenses = await runLiquidCheck(UniqueStaticBlockId, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "The id 'static-block' is already being used by another static block",
    );
  });

  it('should not report an error when two static blocks have differnt id', async () => {
    const sourceCode = `
     {% content_for "block", type: "text", id: "static-block1" %}
     {% content_for "block", type: "text", id: "static-block2" %}
    `;

    const offenses = await runLiquidCheck(UniqueStaticBlockId, sourceCode);

    expect(offenses).to.have.length(0);
  });

  it('should report an error when two static blocks have same id and different types', async () => {
    const sourceCode = `
     {% content_for "block", type: "text", id: "static-block" %}
     {% content_for "block", type: "url", id: "static-block" %}
    `;

    const offenses = await runLiquidCheck(UniqueStaticBlockId, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "The id 'static-block' is already being used by another static block",
    );
  });

  it('should not report an error when two static blocks have different id and different types', async () => {
    const sourceCode = `
     {% content_for "block", type: "text", id: "static-block1" %}
     {% content_for "block", type: "url", id: "static-block2" %}
    `;

    const offenses = await runLiquidCheck(UniqueStaticBlockId, sourceCode);

    expect(offenses).to.have.length(0);
  });
});
