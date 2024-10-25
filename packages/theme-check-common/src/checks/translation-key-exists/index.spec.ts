import { TranslationKeyExists } from '.';
import { check } from '../../test';
import { expect, describe, it } from 'vitest';

describe('Module: TranslationKeyExists', () => {
  it('should report all keys if default locale file does not exist', async () => {
    const offenses = await check(
      {
        'code.liquid': `{{"key" | t}}
{{"nested.key" | t}}`,
      },
      [TranslationKeyExists],
    );
    expect(offenses).to.have.length(2);
  });

  it('should report nothing if default locale file is invalid', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': '{',
        'code.liquid': `{{"key" | t}}
{{"nested.key" | t}}
{% schema %}
  {
    "locales": {
      "en": {
        "key": "I will be ignored",
        "nested": {
          "key": "Me too!"
        }
      }
    }
  }
{% endschema %}`,
      },
      [TranslationKeyExists],
    );
    expect(offenses).to.have.length(0);
  });

  it('should report unknown keys even if schema is invalid', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': '{}',
        'code.liquid': `{{"key" | t}}
{% schema %}
  {
{% endschema %}`,
      },
      [TranslationKeyExists],
    );
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: TranslationKeyExists.meta.code,
      message: "'key' does not have a matching entry in 'locales/en.default.json'",
      uri: 'file:///code.liquid',
    });
  });

  it('should ignore existing keys', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          key: '',
          nested: { key: '' },
        }),
        'code.liquid': `{{"key" | t}}
{{"nested.key" | t}}`,
      },
      [TranslationKeyExists],
    );
    expect(offenses).to.have.length(0);
  });

  it('should ignore keys included in schema', async () => {
    const offenses = await check(
      {
        'code.liquid': `{{"submit" | t}}
{{ "this.does.not.exist" | translate }}
{% schema %}
  {
    "locales": {
      "en": {
        "submit": "Subscribe"
      }
    }
  }
{% endschema %}`,
      },
      [TranslationKeyExists],
    );
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: TranslationKeyExists.meta.code,
      message:
        "'this.does.not.exist' does not have a matching entry in 'locales/en.default.json' or 'code.liquid'",
      uri: 'file:///code.liquid',
      start: { index: 20, line: 1, character: 3 },
      end: { index: 41, line: 1, character: 24 },
    });
  });

  it('should not crash if the schema locales does not exist', async () => {
    const offenses = await check(
      {
        'code.liquid': `
          {{ "this.does.not.exist" | translate }}
          {% schema %}
            {
              "name": "Slideshow",
              "tag": "section",
              "class": "slideshow",
              "limit": 1
            }
          {% endschema %}`,
      },
      [TranslationKeyExists],
    );
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: TranslationKeyExists.meta.code,
      message: "'this.does.not.exist' does not have a matching entry in 'locales/en.default.json'",
      uri: 'file:///code.liquid',
      start: { index: 14, line: 1, character: 13 },
      end: { index: 35, line: 1, character: 34 },
    });
  });

  it('should only report unknown keys for translate filter', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': '{}',
        'code.liquid': `{{ "unknownkey" | t }}
{{ "do.not.report.me" | unknown_filter }}
{{ "unknown.nested.key" | translate }}`,
      },
      [TranslationKeyExists],
    );

    expect(offenses).to.have.length(2);
    expect(offenses).to.containOffense({
      check: TranslationKeyExists.meta.code,
      message: "'unknownkey' does not have a matching entry in 'locales/en.default.json'",
      uri: 'file:///code.liquid',
      start: { index: 3, line: 0, character: 3 },
      end: { index: 15, line: 0, character: 15 },
    });
    expect(offenses).to.containOffense({
      check: TranslationKeyExists.meta.code,
      message: "'unknown.nested.key' does not have a matching entry in 'locales/en.default.json'",
      uri: 'file:///code.liquid',
      start: { index: 68, line: 2, character: 3 },
      end: { index: 88, line: 2, character: 23 },
    });
  });

  it('should count Shopify-provided translations as defined', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': '{}',
        'code.liquid': `{{ 'shopify.sentence.words_connector' | t }}
{{ 'shopify.this.does.not.exist' | t }}`,
      },
      [TranslationKeyExists],
    );

    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: TranslationKeyExists.meta.code,
      message:
        "'shopify.this.does.not.exist' does not have a matching entry in 'locales/en.default.json'",
      uri: 'file:///code.liquid',
      start: { index: 48, line: 1, character: 3 },
      end: { index: 77, line: 1, character: 32 },
    });
  });

  it('should handle key conflicts', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          product: { quantity: 'TODO' },
        }),
        'code.liquid': '{{"product.quantity.decrease" | t}}',
      },
      [TranslationKeyExists],
    );

    expect(offenses).to.have.length(1);
  });
});
