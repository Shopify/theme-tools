import { expect, describe, it, vi } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { Offense } from '../../types';
import { LiquidHTMLSyntaxError } from './index';

describe('Module: LiquidHTMLSyntaxError', () => {
  it('should report unclosed Liquid tags', async () => {
    const sourceCode = `
      {% capture some_variable %}
        Hello, world!
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      `Attempting to end parsing before LiquidTag 'capture' was closed`,
    );
  });

  it('should report unclosed HTML tags', async () => {
    const sourceCode = `
      <a href="abc">
        Hello, world!
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      `Attempting to end parsing before HtmlElement 'a' was closed`,
    );
  });

  it('should report closing the wrong node (html/html)', async () => {
    const sourceCode = `
      <a href="abc">
        Hello, world!
      </b>
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      `Attempting to close HtmlElement 'b' before HtmlElement 'a' was closed`,
    );
  });

  it('should report closing the wrong node (html/liquid)', async () => {
    const sourceCode = `
      <a href="abc">
        Hello, world!
      {% endif %}
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      `Attempting to close LiquidTag 'if' before HtmlElement 'a' was closed`,
    );
  });

  it('should report unexpected tokens (1)', async () => {
    const sourceCode = `
      {% if cond }}
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(`SyntaxError: expected "%}"`);
  });

  it('should report unexpected tokens (2)', async () => {
    const sourceCode = `
      <a href="abc" "></a>
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(`SyntaxError: expected ">", not """`);
  });

  it('should report unexpected tokens (3)', async () => {
    const sourceCode = `
      <a href="abc" {%></a>
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      `SyntaxError: expected "#", a letter, "when", "sections", "section", "render", "liquid", "layout", "increment", "include", "elsif", "else", "echo", "decrement", "content_for", "cycle", "continue", "break", "assign", "tablerow", "unless", "if", "ifchanged", "for", "case", "capture", "paginate", "form", "end", "style", "stylesheet", "schema", "javascript", "raw", "comment", or "doc"`,
    );
  });

  it('should not report syntax error in valid Liquid code', async () => {
    const sourceCode = `
      {% if some_variable %}
        Hello, world!
      {% endif %}
      {% schema %}
      {
        "settings": [{ "visible_if": "{{ foo.bar == true }}" }]
      }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.be.empty;
  });

  it('should highligh the error', async () => {
    let offenses: Offense[];
    let highlights: string[];
    let source: string;

    source = `<div><a></b></div>`;
    offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);
    highlights = highlightedOffenses({ 'file.liquid': source }, offenses);
    expect(highlights).to.include('<a></b>');

    source = `<div><a>{% endif %}</div>`;
    offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);
    highlights = highlightedOffenses({ 'file.liquid': source }, offenses);
    expect(highlights).to.include('<a>{% endif %}');

    source = `<a href=abc ">`;
    offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);
    highlights = highlightedOffenses({ 'file.liquid': source }, offenses);
    expect(highlights).to.include('"');
  });
});
