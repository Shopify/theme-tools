import { expect, describe, it } from 'vitest';
import { UnclosedHTMLElement } from '.';
import { runLiquidCheck, highlightedOffenses } from '../../test';

describe('Module: UnclosedHTMLElement', () => {
  it('should not report for files without unbalanced tags', async () => {
    const testCases = [
      `
        <div>
          {% if cond %}
            <details>
              <summary>
          {% else %}
            <h2>
          {% endif %}

          {% if cond %}
            </summary>
          {% else %}
            </h2>
          {% endif %}

          {% if cond %}
            </details>
          {% endif %}
        </div>
      `,
      `
        <div>
          {% if cond %}
          {% else %}
            <h1>
          {% endif %}

          {% unless cond %}
            </h1>
          {% endunless %}
        </div>
      `,
      `
        <div>
          {% case thing %}
          {% when 'one', 'two' %}
            <h1>
          {% when 'three' %}
            <h3>
          {% else %}
            <p>
          {% endcase %}

          {% case thing %}
          {% when 'one','two' %}
            </h1>
          {% when 'three' %}
            </h3>
          {% else %}
            </p>
          {% endunless %}
        </div>
      `,
    ];

    for (const file of testCases) {
      const offenses = await runLiquidCheck(UnclosedHTMLElement, file);

      expect(offenses, file).to.have.length(0);
    }
  });

  it('should not report offenses for similarly written, but not string-equal, conditions', async () => {
    const testCases = [
      ['number>10', 'number > 10'], // whitespace insensitive
      ['"string"', `'string'`],
      ['x == nil', 'x==null'], // nil == null
      ['x.a', 'x["a"]'],
      ['(0..a)', '( 0 .. a )'],
      ['a or b', 'a     or     b'],
    ];
    for (const [cond1, cond2] of testCases) {
      const file = `
        {% if ${cond1} %}
          <h1>
        {% endif %}

        {% if ${cond2} %}
          </h1>
        {% endif %}
      `;
      const offenses = await runLiquidCheck(UnclosedHTMLElement, file);
      expect(offenses).to.be.empty;
    }
  });

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

  it('should report offenses when conditions do not match', async () => {
    const file = `
      <div>
        {% if some_condition %}
          <details>
        {% else %}
          <aside>
        {% endif %}

        {% if other_condition %}
          </details>
        {% else %}
          </aside>
        {% endif %}
      </div>
    `;

    const offenses = await runLiquidCheck(UnclosedHTMLElement, file);

    expect(offenses).to.have.length(4);
    expect(highlightedOffenses(file, offenses)).to.include('<details>');
    expect(highlightedOffenses(file, offenses)).to.include('<aside>');
    expect(highlightedOffenses(file, offenses)).to.include('</details>');
    expect(highlightedOffenses(file, offenses)).to.include('</aside>');
  });

  it('should report an offense for unclosed or unopened in case statements', async () => {
    const file = `
    <div>
      {% case thing %}
        {% when 'one' %}
          <h1>
        {% else %}
          <p>
      {% endcase %}

      {% case thing %}
        {% when 'two' %}
          </h2>
      {% endcase %}
    </div>
  `;

    const offenses = await runLiquidCheck(UnclosedHTMLElement, file);

    expect(offenses).to.have.length(3);
    expect(highlightedOffenses(file, offenses)).to.include('<h1>');
    expect(highlightedOffenses(file, offenses)).to.include('<p>');
    expect(highlightedOffenses(file, offenses)).to.include('</h2>');
  });

  it('should report an offense for doubly unclosed of the same name', async () => {
    const file = `
    <div>
      {% if thing %}
        </h1>
      {% endif %}

      {% if thing %}
        </h1>
      {% endif %}
    </div>
  `;

    const offenses = await runLiquidCheck(UnclosedHTMLElement, file);

    expect(offenses).to.have.length(2);
    expect(highlightedOffenses(file, offenses)).to.include('</h1>');
  });
});
