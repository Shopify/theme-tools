import { expect, describe, it } from 'vitest';
import { check } from '../../test';
import { UnusedTranslationKey } from '.';

describe('Module: UnusedTranslationKey', () => {
  it('reports unused default locale keys', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          actions: {
            add: 'Add',
            remove: 'Remove',
          },
        }),
        'snippets/cart.liquid': `{{ 'actions.add' | t }}`,
      },
      [UnusedTranslationKey],
    );

    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: UnusedTranslationKey.meta.code,
      message: "Translation key 'actions.remove' is not statically referenced",
      uri: 'file:///locales/en.default.json',
    });
    expect(offenses[0]!).to.suggest(
      JSON.stringify({
        actions: {
          add: 'Add',
          remove: 'Remove',
        },
      }),
      'Delete unused translation key',
      {
        startIndex: 0,
        endIndex: JSON.stringify({
          actions: {
            add: 'Add',
            remove: 'Remove',
          },
        }).length,
        insert: JSON.stringify({ actions: { add: 'Add' } }, null, 2),
      },
    );
  });

  it('does not report non-default locale keys', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          actions: {
            add: 'Add',
          },
        }),
        'locales/fr.json': JSON.stringify({
          actions: {
            add: 'Ajouter',
            remove: 'Supprimer',
          },
        }),
      },
      [UnusedTranslationKey],
    );

    expect(offenses).to.have.length(1);
    expect(offenses[0].uri).to.equal('file:///locales/en.default.json');
  });

  it('does not report keys referenced with the translate filter', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          actions: {
            add: 'Add',
          },
        }),
        'snippets/cart.liquid': `{{ 'actions.add' | translate }}`,
      },
      [UnusedTranslationKey],
    );

    expect(offenses).to.have.length(0);
  });

  it('does not report keys referenced by static append chains', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          products: {
            product: {
              add_to_cart: 'Add to cart',
            },
          },
        }),
        'snippets/product-form.liquid': `
          {{ 'products.' | append: 'product.' | append: 'add_to_cart' | t }}
        `,
      },
      [UnusedTranslationKey],
    );

    expect(offenses).to.have.length(0);
  });

  it('does not report keys below a statically known prefix', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          products: {
            product: {
              add_to_cart: 'Add to cart',
            },
          },
          cart: {
            title: 'Cart',
          },
        }),
        'snippets/product-form.liquid': `{{ 'products.product.' | append: button_state | t }}`,
      },
      [UnusedTranslationKey],
    );

    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense("Translation key 'cart.title' is not statically referenced");
  });

  it('does not report storefront locale keys when a dynamic translation key has no static prefix', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          actions: {
            add: 'Add',
          },
        }),
        'snippets/cart.liquid': `{{ translation_key | t }}`,
      },
      [UnusedTranslationKey],
    );

    expect(offenses).to.have.length(0);
  });

  it('does not infer a static prefix from assigned dynamic translation keys', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          actions: {
            add: 'Add',
          },
        }),
        'snippets/cart.liquid': `
          {% assign translation_key = 'actions.' | append: action %}
          {{ translation_key | t }}
        `,
      },
      [UnusedTranslationKey],
    );

    expect(offenses).to.have.length(0);
  });

  it('treats pluralization leaves as used when their parent key is referenced', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          cart: {
            items: {
              one: '{{ count }} item',
              other: '{{ count }} items',
            },
          },
        }),
        'snippets/cart.liquid': `{{ 'cart.items' | t: count: cart.item_count }}`,
      },
      [UnusedTranslationKey],
    );

    expect(offenses).to.have.length(0);
  });

  it('does not report schema locale keys referenced by schema t-prefixed values', async () => {
    const offenses = await check(
      {
        'locales/en.default.schema.json': JSON.stringify({
          sections: {
            header: {
              name: 'Header',
              settings: {
                title: {
                  label: 'Title',
                  info: 'Info',
                },
              },
            },
          },
        }),
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
      },
      [UnusedTranslationKey],
    );

    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense(
      "Translation key 'sections.header.settings.title.info' is not statically referenced",
    );
  });

  it('does not report schema locale keys referenced by settings_schema.json t-prefixed values', async () => {
    const offenses = await check(
      {
        'locales/en.default.schema.json': JSON.stringify({
          theme_settings: {
            colors: {
              name: 'Colors',
              accent: {
                label: 'Accent',
                info: 'Choose an accent color',
              },
            },
          },
        }),
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
      },
      [UnusedTranslationKey],
    );

    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense(
      "Translation key 'theme_settings.colors.accent.info' is not statically referenced",
    );
  });

  it('does not count schema translation references as storefront locale references', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          sections: {
            header: {
              name: 'Header',
            },
          },
        }),
        'locales/en.default.schema.json': JSON.stringify({
          sections: {
            header: {
              name: 'Header',
            },
          },
        }),
        'sections/header.liquid': `
          {% schema %}
          {
            "name": "t:sections.header.name"
          }
          {% endschema %}
        `,
      },
      [UnusedTranslationKey],
    );

    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      message: "Translation key 'sections.header.name' is not statically referenced",
      uri: 'file:///locales/en.default.json',
    });
  });

  it('still reports schema locale keys when a storefront dynamic key has no static prefix', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          actions: {
            add: 'Add',
          },
        }),
        'locales/en.default.schema.json': JSON.stringify({
          sections: {
            header: {
              name: 'Header',
              settings: {
                title: {
                  label: 'Title',
                },
              },
            },
          },
        }),
        'snippets/cart.liquid': `{{ translation_key | t }}`,
        'sections/header.liquid': `
          {% schema %}
          {
            "name": "t:sections.header.name"
          }
          {% endschema %}
        `,
      },
      [UnusedTranslationKey],
    );

    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      message:
        "Translation key 'sections.header.settings.title.label' is not statically referenced",
      uri: 'file:///locales/en.default.schema.json',
    });
  });

  it('ignores configured translation key patterns', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          dynamic: {
            managed_elsewhere: 'Managed elsewhere',
          },
        }),
      },
      [UnusedTranslationKey],
      {},
      {
        UnusedTranslationKey: {
          enabled: true,
          ignoreKeys: ['dynamic.*'],
        },
      },
    );

    expect(offenses).to.have.length(0);
  });

  it('ignores Shopify-provided translation key namespaces by default', async () => {
    const offenses = await check(
      {
        'locales/en.default.json': JSON.stringify({
          shopify: {
            sentence: {
              words_connector: ', ',
            },
          },
          customer_accounts: {
            sign_in: 'Sign in',
          },
        }),
      },
      [UnusedTranslationKey],
    );

    expect(offenses).to.have.length(0);
  });
});
