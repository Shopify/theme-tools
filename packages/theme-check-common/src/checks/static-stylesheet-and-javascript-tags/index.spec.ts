import { check, highlightedOffenses } from '../../test';
import { expect, describe, it } from 'vitest';
import { StaticStylesheetAndJavascriptTags } from './index';

describe('Module: StaticStylesheetAndJavascriptTags', () => {
  it('should not report errors for static CSS content in stylesheet tags', async () => {
    const theme = {
      'templates/test.liquid': `
        {% stylesheet %}
          .button {
            background-color: blue;
            color: white;
            padding: 10px 20px;
          }
        {% endstylesheet %}
      `,
    };

    const offenses = await check(theme, [StaticStylesheetAndJavascriptTags]);
    expect(offenses).to.have.length(0);
  });

  it('should not report errors for static JavaScript content in javascript tags', async () => {
    const theme = {
      'templates/test.liquid': `
        {% javascript %}
          function greet(name) {
            console.log('Hello, ' + name + '!');
          }
          greet('World');
        {% endjavascript %}
      `,
    };

    const offenses = await check(theme, [StaticStylesheetAndJavascriptTags]);
    expect(offenses).to.have.length(0);
  });

  it('should report error for liquid variable in stylesheet tag', async () => {
    const theme = {
      'templates/test.liquid': `
        {% stylesheet %}
          .button {
            background-color: {{ settings.button_color }};
            color: white;
          }
        {% endstylesheet %}
      `,
    };

    const offenses = await check(theme, [StaticStylesheetAndJavascriptTags]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'Liquid variable found in CSS block. {% stylesheet %} tags should only contain static CSS code.',
    );

    const highlights = highlightedOffenses(theme, offenses);
    expect(highlights).to.eql(['{{ settings.button_color }}']);
  });

  it('should report error for liquid variable in javascript tag', async () => {
    const theme = {
      'templates/test.liquid': `
        {% javascript %}
          const apiUrl = '{{ shop.url }}';
          fetch(apiUrl);
        {% endjavascript %}
      `,
    };

    const offenses = await check(theme, [StaticStylesheetAndJavascriptTags]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'Liquid variable found in JavaScript block. {% javascript %} tags should only contain static JavaScript code.',
    );

    const highlights = highlightedOffenses(theme, offenses);
    expect(highlights).to.eql(['{{ shop.url }}']);
  });

  it('should report error for liquid tag in stylesheet tag', async () => {
    const theme = {
      'templates/test.liquid': `
        {% stylesheet %}
          .button {
            {% if settings.enable_hover %}
              background-color: blue;
            {% endif %}
          }
        {% endstylesheet %}
      `,
    };

    const offenses = await check(theme, [StaticStylesheetAndJavascriptTags]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'Liquid tag found in CSS block. {% stylesheet %} tags should only contain static CSS code.',
    );

    const highlights = highlightedOffenses(theme, offenses);
    expect(highlights).to.eql([
      `{% if settings.enable_hover %}
              background-color: blue;
            {% endif %}`,
    ]);
  });

  it('should report error for liquid tag in javascript tag', async () => {
    const theme = {
      'templates/test.liquid': `
        {% javascript %}
          {% if settings.enable_analytics %}
            console.log('Analytics enabled');
          {% endif %}
        {% endjavascript %}
      `,
    };

    const offenses = await check(theme, [StaticStylesheetAndJavascriptTags]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'Liquid tag found in JavaScript block. {% javascript %} tags should only contain static JavaScript code.',
    );

    const highlights = highlightedOffenses(theme, offenses);
    expect(highlights).to.eql([
      `{% if settings.enable_analytics %}
            console.log('Analytics enabled');
          {% endif %}`,
    ]);
  });

  it('should report multiple errors for multiple liquid nodes', async () => {
    const theme = {
      'templates/test.liquid': `
        {% stylesheet %}
          .button {
            background-color: {{ settings.button_color }};
            {% if settings.show_border %}
              border: 1px solid {{ settings.border_color }};
            {% endif %}
          }
        {% endstylesheet %}
      `,
    };

    const offenses = await check(theme, [StaticStylesheetAndJavascriptTags]);
    expect(offenses).to.have.length(2);
    expect(offenses[0].message).to.include('Liquid variable found in CSS block');
    expect(offenses[1].message).to.include('Liquid tag found in CSS block');

    const highlights = highlightedOffenses(theme, offenses);
    expect(highlights).to.eql([
      '{{ settings.button_color }}',
      `{% if settings.show_border %}
              border: 1px solid {{ settings.border_color }};
            {% endif %}`,
    ]);
  });

  it('should not report errors for other raw tags like schema', async () => {
    const theme = {
      'sections/test.liquid': `
        {% schema %}
        {
          "name": "Section",
          "settings": [
            {
              "id": "color",
              "type": "color",
              "default": "{{ settings.default_color }}"
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [StaticStylesheetAndJavascriptTags]);
    expect(offenses).to.have.length(0);
  });

  it('should not report errors for liquid in regular content outside raw tags', async () => {
    const theme = {
      'templates/test.liquid': `
        <div style="color: {{ settings.text_color }};">
          {% if product.available %}
            <button>Buy now</button>
          {% endif %}
        </div>

        {% stylesheet %}
          .static-style {
            margin: 10px;
          }
        {% endstylesheet %}
      `,
    };

    const offenses = await check(theme, [StaticStylesheetAndJavascriptTags]);
    expect(offenses).to.have.length(0);
  });

  it('should report nested raw tags inside stylesheet tags', async () => {
    const theme = {
      'templates/test.liquid': `
        {% stylesheet %}
          /* This should trigger an error */
          {% raw %}
            .nested { color: red; }
          {% endraw %}
        {% endstylesheet %}
      `,
    };

    const offenses = await check(theme, [StaticStylesheetAndJavascriptTags]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include('Liquid tag found in CSS block');

    const highlights = highlightedOffenses(theme, offenses);
    expect(highlights).to.eql([
      `{% raw %}
            .nested { color: red; }
          {% endraw %}`,
    ]);
  });

  it('should not report offenses for empty stylesheet and javascript blocks', async () => {
    const theme = {
      'templates/test.liquid': `
        {% stylesheet %}
        {% endstylesheet %}

        {% javascript %}
        {% endjavascript %}
      `,
    };

    const offenses = await check(theme, [StaticStylesheetAndJavascriptTags]);
    expect(offenses).to.have.length(0);
  });

  it('should not report errors for liquid in style tags (different from stylesheet)', async () => {
    const theme = {
      'templates/test.liquid': `
        {% style %}
          .button {
            color: {{ settings.color }};
          }
        {% endstyle %}
      `,
    };

    const offenses = await check(theme, [StaticStylesheetAndJavascriptTags]);
    expect(offenses).to.have.length(0);
  });
});
