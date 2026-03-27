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

  it('should not report an error when two static blocks have different id', async () => {
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

  it('should not report an error when blocks share the same id but have different arbitrary params', async () => {
    const sourceCode = `
     {% content_for "block", type: "text", id: "header-menu", variant: "mobile" %}
     {% content_for "block", type: "text", id: "header-menu", variant: "navigation_bar" %}
     {% content_for "block", type: "text", id: "header-menu" %}
    `;

    const offenses = await runLiquidCheck(UniqueStaticBlockId, sourceCode);

    expect(offenses).to.have.length(0);
  });

  it('should report an error when blocks share the same id and same arbitrary params', async () => {
    const sourceCode = `
     {% content_for "block", type: "text", id: "header-menu", variant: "mobile" %}
     {% content_for "block", type: "text", id: "header-menu", variant: "mobile" %}
    `;

    const offenses = await runLiquidCheck(UniqueStaticBlockId, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "The id 'header-menu' is already being used by another static block",
    );
  });

  it('should not report an error when blocks share the same id but have different values for the same param', async () => {
    const sourceCode = `
     {% content_for "block", type: "text", id: "sidebar", color: "blue" %}
     {% content_for "block", type: "text", id: "sidebar", color: "red" %}
    `;

    const offenses = await runLiquidCheck(UniqueStaticBlockId, sourceCode);

    expect(offenses).to.have.length(0);
  });

  it('should report an error when blocks share the same id and multiple matching params', async () => {
    const sourceCode = `
     {% content_for "block", type: "text", id: "sidebar", color: "blue", size: "large" %}
     {% content_for "block", type: "text", id: "sidebar", color: "blue", size: "large" %}
    `;

    const offenses = await runLiquidCheck(UniqueStaticBlockId, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "The id 'sidebar' is already being used by another static block",
    );
  });

  it('should report an error when blocks have same params in different order', async () => {
    const sourceCode = `
     {% content_for "block", type: "text", id: "sidebar", color: "blue", size: "large" %}
     {% content_for "block", type: "text", id: "sidebar", size: "large", color: "blue" %}
    `;

    const offenses = await runLiquidCheck(UniqueStaticBlockId, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "The id 'sidebar' is already being used by another static block",
    );
  });

  it('should not report an error when any arbitrary param is a variable lookup', async () => {
    const sourceCode = `
     {% content_for "block", type: "text", id: "header-menu", variant: "mobile" %}
     {% content_for "block", type: "text", id: "header-menu", variant: some_variable %}
    `;

    const offenses = await runLiquidCheck(UniqueStaticBlockId, sourceCode);

    expect(offenses).to.have.length(0);
  });

  it('should not report an error when two blocks use the same variable lookup', async () => {
    const sourceCode = `
     {% content_for "block", type: "text", id: "header-menu", variant: some_variable %}
     {% content_for "block", type: "text", id: "header-menu", variant: some_variable %}
    `;

    const offenses = await runLiquidCheck(UniqueStaticBlockId, sourceCode);

    expect(offenses).to.have.length(0);
  });
});
