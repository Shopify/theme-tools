import { describe, expect, it } from 'vitest';
import { getTheme } from '../test';
import { findTranslationReferences, isTranslationKeyUsed } from './translation-references';

describe('findTranslationReferences', () => {
  it('collects literal t and translate filter keys', () => {
    const result = findTranslationReferences(
      getTheme({
        'snippets/cart.liquid': `
          {{ 'actions.add' | t }}
          {{ "actions.remove" | translate }}
        `,
      }),
    );

    expect(result.keys).toEqual(new Set(['actions.add', 'actions.remove']));
    expect(result.schemaKeys).toEqual(new Set());
    expect(result.prefixes).toEqual(new Set());
    expect(result.hasDynamicReferences).toBe(false);
  });

  it('collects schema locale references separately from storefront locale references', () => {
    const result = findTranslationReferences(
      getTheme({
        'sections/header.liquid': `
          {% schema %}
          {
            "name": "t:sections.header.name",
            "settings": [
              {
                "type": "text",
                "id": "title",
                "label": "t:sections.header.settings.title.label"
              }
            ]
          }
          {% endschema %}
        `,
      }),
    );

    expect(result.keys).toEqual(new Set());
    expect(result.schemaKeys).toEqual(
      new Set(['sections.header.name', 'sections.header.settings.title.label']),
    );
  });

  it('collects schema locale references from settings_schema.json', () => {
    const result = findTranslationReferences(
      getTheme({
        'config/settings_schema.json': JSON.stringify([
          {
            name: 't:theme_settings.colors.name',
            settings: [
              {
                type: 'color',
                id: 'accent',
                label: 't:theme_settings.colors.accent.label',
              },
            ],
          },
        ]),
      }),
    );

    expect(result.keys).toEqual(new Set());
    expect(result.schemaKeys).toEqual(
      new Set(['theme_settings.colors.name', 'theme_settings.colors.accent.label']),
    );
    expect(result.prefixes).toEqual(new Set());
    expect(result.hasDynamicReferences).toBe(false);
  });

  it('does not collect schema locale references from arbitrary JSON files', () => {
    const result = findTranslationReferences(
      getTheme({
        'locales/en.default.schema.json': JSON.stringify({
          sections: {
            header: {
              name: 't:sections.header.name',
            },
          },
        }),
      }),
    );

    expect(result.schemaKeys).toEqual(new Set());
  });

  it('resolves static append filters', () => {
    const result = findTranslationReferences(
      getTheme({
        'snippets/product-form.liquid': `
          {{ 'product.' | append: 'title' | t }}
        `,
      }),
    );

    expect(result.keys).toEqual(new Set(['product.title']));
    expect(result.prefixes).toEqual(new Set());
    expect(result.hasDynamicReferences).toBe(false);
  });

  it('resolves static prepend filters in prefix-first order', () => {
    const result = findTranslationReferences(
      getTheme({
        'snippets/product-form.liquid': `
          {{ 'title' | prepend: 'product.' | translate }}
        `,
      }),
    );

    expect(result.keys).toEqual(new Set(['product.title']));
    expect(result.prefixes).toEqual(new Set());
    expect(result.hasDynamicReferences).toBe(false);
  });

  it('records the last statically known prefix for dynamic append chains', () => {
    const result = findTranslationReferences(
      getTheme({
        'snippets/product-form.liquid': `
          {{ 'products.product.' | append: button_state | t }}
        `,
      }),
    );

    expect(result.keys).toEqual(new Set());
    expect(result.prefixes).toEqual(new Set(['products.product.']));
    expect(result.hasDynamicReferences).toBe(false);
  });

  it('does not keep a prefix when a dynamic prepend changes the beginning of the key', () => {
    const result = findTranslationReferences(
      getTheme({
        'snippets/product-form.liquid': `
          {{ 'title' | prepend: product_type | t }}
        `,
      }),
    );

    expect(result.keys).toEqual(new Set());
    expect(result.prefixes).toEqual(new Set());
    expect(result.hasDynamicReferences).toBe(true);
  });

  it('updates a dynamic chain prefix when a static prepend adds a known beginning', () => {
    const result = findTranslationReferences(
      getTheme({
        'snippets/product-form.liquid': `
          {{ 'title.' | append: product_state | prepend: 'products.' | t }}
        `,
      }),
    );

    expect(result.keys).toEqual(new Set());
    expect(result.prefixes).toEqual(new Set(['products.title.']));
    expect(result.hasDynamicReferences).toBe(false);
  });

  it('marks keys transformed by unsupported filters as dynamic references', () => {
    const result = findTranslationReferences(
      getTheme({
        'snippets/product-form.liquid': `
          {{ 'products.product.' | replace: 'product.', '' | append: button_state | t }}
        `,
      }),
    );

    expect(result.keys).toEqual(new Set());
    expect(result.prefixes).toEqual(new Set());
    expect(result.hasDynamicReferences).toBe(true);
  });

  it('marks dynamic translation keys with no static prefix as dynamic references', () => {
    const result = findTranslationReferences(
      getTheme({
        'snippets/cart.liquid': `{{ translation_key | t }}`,
      }),
    );

    expect(result.keys).toEqual(new Set());
    expect(result.prefixes).toEqual(new Set());
    expect(result.hasDynamicReferences).toBe(true);
  });
});

describe('isTranslationKeyUsed', () => {
  it('treats pluralization leaves as used when their parent key is referenced', () => {
    const refs = findTranslationReferences(
      getTheme({
        'snippets/cart.liquid': `{{ 'cart.items' | t: count: cart.item_count }}`,
      }),
    );

    expect(isTranslationKeyUsed('cart.items.one', refs)).toBe(true);
    expect(isTranslationKeyUsed('cart.items.other', refs)).toBe(true);
  });

  it('uses schema keys only for schema translation files', () => {
    const refs = findTranslationReferences(
      getTheme({
        'sections/header.liquid': `
          {% schema %}
          { "name": "t:sections.header.name" }
          {% endschema %}
        `,
      }),
    );

    expect(isTranslationKeyUsed('sections.header.name', refs)).toBe(false);
    expect(isTranslationKeyUsed('sections.header.name', refs, true)).toBe(true);
  });
});
