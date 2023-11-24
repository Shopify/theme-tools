import { expect, describe, it } from 'vitest';
import { UnclosedHTMLElement } from '.';
import { runLiquidCheck, highlightedOffenses } from '../../test';

describe('Module: UnclosedHTMLElement', () => {
  it('should report an offense for a branch open tag without its close tag', async () => {
    const file = `
      <div>
        {% if cond %}
          <main>
        {% endif %}
      </div>
    `;

    const offenses = await runLiquidCheck(UnclosedHTMLElement, file);

    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      message: `Opening tag does not have a matching closing tag for condition \`cond\` in HtmlElement 'div'`,
    });
    expect(highlightedOffenses(file, offenses)).to.include('<main>');
  });

  it('should report an offense for a branch close tag without its open tag', async () => {
    const file = `
      <div>
        {% if cond %}
          </main>
        {% endif %}
      </div>
    `;

    const offenses = await runLiquidCheck(UnclosedHTMLElement, file);

    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      message: `Closing tag does not have a matching opening tag for condition \`cond\` in HtmlElement 'div'`,
    });
    expect(highlightedOffenses(file, offenses)).to.include('</main>');
  });

  it('should report offenses when branches are closed in the wrong order', async () => {
    const file = `
      <div>
        {% if cond %}
          <details>
            <summary>
        {% endif %}

        {% if cond %}
          </details>
          </summary>
        {% endif %}
      </div>
    `;

    const offenses = await runLiquidCheck(UnclosedHTMLElement, file);

    expect(offenses).to.have.length(4);
    expect(offenses).to.containOffense({
      message: `Closing tag does not have a matching opening tag for condition \`cond\` in HtmlElement 'div'`,
    });
    expect(highlightedOffenses(file, offenses)).to.include('<details>');
    expect(highlightedOffenses(file, offenses)).to.include('<summary>');
    expect(highlightedOffenses(file, offenses)).to.include('</details>');
    expect(highlightedOffenses(file, offenses)).to.include('</summary>');
  });

  it('should report offenses when branches are closed in the wrong node', async () => {
    const file = `
      <div>
        {% if cond %}
          <details>
            <summary>
        {% endif %}

        <div>
          {% if cond %}
            </details>
            </summary>
          {% endif %}
        </div>
      </div>

      {% if cond %}
        </details>
        </summary>
      {% endif %}
    `;

    const offenses = await runLiquidCheck(UnclosedHTMLElement, file);

    expect(offenses).to.have.length(6);
    expect(offenses).to.containOffense({
      message: `Closing tag does not have a matching opening tag for condition \`cond\` in HtmlElement 'div'`,
    });
    expect(highlightedOffenses(file, offenses)).to.include('<details>');
    expect(highlightedOffenses(file, offenses)).to.include('<summary>');
    expect(highlightedOffenses(file, offenses)).to.include('</details>');
    expect(highlightedOffenses(file, offenses)).to.include('</summary>');
  });

  it('should not report for files without unbalanced tags', async () => {
    const file = `
      <div>
        {% if cond %}
          <details>
            <summary>
        {% endif %}

        {% if cond %}
          </summary>
          </details>
        {% endif %}
      </div>
    `;

    const offenses = await runLiquidCheck(UnclosedHTMLElement, file);

    expect(offenses).to.have.length(0);
  });
});
