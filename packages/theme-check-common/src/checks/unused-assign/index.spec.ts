import { expect, describe, it } from 'vitest';
import { UnusedAssign } from './index';
import { runLiquidCheck, applySuggestions } from '../../test';

describe('Module: UnusedAssign', () => {
  it('should report an error when a variable is assigned but not used', async () => {
    const sourceCode = `
      {% assign unusedVar = "value" %}
      {% assign usedVar = "anotherValue" %}
      {{ usedVar }}
    `;

    const offenses = await runLiquidCheck(UnusedAssign, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal("The variable 'unusedVar' is assigned but not used");
  });

  it('should not report an error when a variable is assigned and used', async () => {
    const sourceCode = `
      {% assign usedVar = "value" %}
      {{ usedVar }}
    `;

    const offenses = await runLiquidCheck(UnusedAssign, sourceCode);

    expect(offenses).to.be.empty;
  });

  it('should provide a suggestion to remove the unused variable', async () => {
    const sourceCode = `
      {% assign unusedVar = "value" %}
    `;

    const offenses = await runLiquidCheck(UnusedAssign, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].suggest).to.have.length(1);
    expect(offenses[0]!.suggest![0].message).to.equal("Remove the unused variable 'unusedVar'");
  });

  it('should fix the code by removing the unused variable', async () => {
    const sourceCode = `
      {% assign unusedVar = "value" %}
      {% assign usedVar = "anotherValue" %}
      {{ usedVar }}
    `;

    const offenses = await runLiquidCheck(UnusedAssign, sourceCode);
    const suggestions = applySuggestions(sourceCode, offenses[0]);

    // We're not deleting the line, that's prettier's job.
    const expectedFixedCode = `
      ${''}
      {% assign usedVar = "anotherValue" %}
      {{ usedVar }}
    `;

    expect(suggestions).to.include(expectedFixedCode);
  });

  it('should not report unused assigns for things used in a capture tag', async () => {
    const sourceCode = `
      {% assign usedVar = "anotherValue" %}
      {% capture foo %}
        {{ usedVar }}
      {% endcapture %}
      {{ foo }}
    `;

    const offenses = await runLiquidCheck(UnusedAssign, sourceCode);
    expect(offenses).to.be.empty;
  });

  it('should report unused capture', async () => {
    const sourceCode = `
      {% assign usedVar = "anotherValue" %}
      {% capture foo %}
        {{ usedVar }}
      {% endcapture %}
    `;

    const offenses = await runLiquidCheck(UnusedAssign, sourceCode);
    expect(offenses).not.to.be.empty;
  });

  it('should not report unused assigns for things used in a raw-like tag', async () => {
    const tags = ['style'];
    for (const tag of tags) {
      const sourceCode = `
        {% assign usedVar = 1 %}
        {% ${tag} %}
          {{ usedVar }}
        {% end${tag} %}
      `;

      const offenses = await runLiquidCheck(UnusedAssign, sourceCode);
      expect(offenses).to.be.empty;
    }
  });

  it('should report unused assigns for things used in raw code that gets stripped away (schema, etc)', async () => {
    const tags = ['schema', 'javascript', 'stylesheet'];
    for (const tag of tags) {
      const sourceCode = `
        {% assign usedVar = 1 %}
        {% ${tag} %}
          {{ usedVar }}
        {% end${tag} %}
      `;

      const offenses = await runLiquidCheck(UnusedAssign, sourceCode);
      expect(offenses).to.not.be.empty;
    }
  });

  it('should not report unused assigns for things used in a HTML raw-like tag', async () => {
    const tags = ['style', 'script'];
    for (const tag of tags) {
      const sourceCode = `
        {% assign usedVar = 1 %}
        <${tag}>
          {{ usedVar }}
        </${tag}>
      `;

      const offenses = await runLiquidCheck(UnusedAssign, sourceCode);
      expect(offenses).to.be.empty;
    }
  });

  it('should not report unused assigns for variables starting with an underscore', async () => {
    const sourceCode = `
      {% assign _ = 1 %}
      {% assign _unusedVar = 1 %}
      {% capture _ %}
        {% form "cart", cart %}
          {% assign some_var = cart.successfully_posted? %}
        {% endform %}
      {% endcapture %}
      {{ some_var }}
    `;

    const offenses = await runLiquidCheck(UnusedAssign, sourceCode);
    expect(offenses).to.have.lengthOf(0);
  });

  it('should report unused assign for things used in a {% raw %} tag', async () => {
    const sourceCode = `
      {% assign unusedVar = 1 %}
      {% # It's a trap. It's not really used %}
      {% raw %}
        {{ unusedVar }}
      {% endraw %}
    `;

    const offenses = await runLiquidCheck(UnusedAssign, sourceCode);
    expect(offenses).to.have.lengthOf(1);
  });
});
