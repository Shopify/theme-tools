import { expect, describe, it } from 'vitest';
import { autofix, check, highlightedOffenses } from '../../test';
import { MatchingTranslations } from '../../checks/matching-translations/index';

const prettyJSON = (json: any) => JSON.stringify(json, null, 2);

describe('Module: MatchingTranslations', async () => {
  it('should require other in a pluralized default translation', async () => {
    const theme = {
      'locales/en.default.json': JSON.stringify({ items: { one: 'One item' } }),
    };

    const offenses = await check(theme, [MatchingTranslations]);

    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      message: "The pluralized translation 'items' is missing the 'other' key",
      uri: 'file:///locales/en.default.json',
    });
    expect(highlightedOffenses(theme, offenses)).to.deep.equal(['"items":{"one":"One item"}']);
    expect(offenses[0].fix).to.be.undefined;
    expect(offenses[0].suggest).to.be.undefined;
  });

  it.each(['zero', 'one', 'two', 'few', 'many'])(
    'should recognize the complete plural category %s',
    async (category) => {
      const offenses = await check(
        { 'locales/en.default.json': JSON.stringify({ items: { [category]: 'Items' } }) },
        [MatchingTranslations],
      );
      expect(offenses).to.have.length(1);
    },
  );

  it('should report each nested pluralized entry once with its source range', async () => {
    const theme = {
      'locales/en.default.json': prettyJSON({
        cart: { items: { zero: 'No items', one: 'One item' } },
        many: { results: { few: 'A few results', many: 'Many results' } },
      }),
    };
    const offenses = await check(theme, [MatchingTranslations]);

    expect(offenses).to.have.length(2);
    for (const path of ['cart.items', 'many.results']) {
      expect(offenses).to.containOffense({
        message: `The pluralized translation '${path}' is missing the 'other' key`,
        uri: 'file:///locales/en.default.json',
      });
    }
    expect(highlightedOffenses(theme, offenses)).to.deep.equal([
      '"items": {\n      "zero": "No items",\n      "one": "One item"\n    }',
      '"results": {\n      "few": "A few results",\n      "many": "Many results"\n    }',
    ]);
  });

  it.each([
    ['other alone', { items: { other: '{{ count }} items' } }],
    ['other with singular', { items: { one: 'One item', other: '{{ count }} items' } }],
    ['ordinary strings', { title: 'Items' }],
    ['empty objects', { items: {} }],
    ['ordinary namespaces', { items: { title: 'Items', description: 'Your items' } }],
    [
      'category-like suffixes',
      { items: { phone: 'Phone', someone: 'Someone', another: 'Another' } },
    ],
    ['mixed category and ordinary keys', { items: { one: 'One', title: 'Items' } }],
    ['category ancestors', { one: { many: { title: 'Items' } } }],
    ['category keys with object values', { items: { one: { title: 'One' } } }],
    ['nonstring values', { items: { one: 1, few: null, many: true } }],
    ['arrays', { items: [{ count: { one: 'One' } }] }],
    [
      'external namespaces',
      { shopify: { items: { one: 'One' } }, customer_accounts: { one: 'One' } },
    ],
  ])('should not infer a missing other for %s', async (_name, translations) => {
    const offenses = await check({ 'locales/en.default.json': JSON.stringify(translations) }, [
      MatchingTranslations,
    ]);
    expect(offenses).to.have.length(0);
  });

  it.each([
    'locales/fr.json',
    'locales/en.default.schema.json',
    'locales/fr.schema.json',
    'assets/en.default.json',
    'config/settings_data.json',
  ])('should not require other in %s', async (file) => {
    const offenses = await check({ [file]: JSON.stringify({ items: { one: 'One item' } }) }, [
      MatchingTranslations,
    ]);
    expect(offenses).to.have.length(0);
  });

  it.each(['}', '{"items":{"one":"One item"}', '[]', 'null', '"Items"'])(
    'should ignore malformed or non-object default translations: %s',
    async (source) => {
      const offenses = await check({ 'locales/en.default.json': source }, [MatchingTranslations]);
      expect(offenses).to.have.length(0);
    },
  );

  it.each([true, false])(
    'should preserve missing and extra diagnostics with requireOther: %s',
    async (requireOther) => {
      const offenses = await check(
        {
          'locales/en.default.json': JSON.stringify({ items: { one: 'One item' }, title: 'Items' }),
          'locales/fr.json': JSON.stringify({
            items: { few: 'Quelques articles' },
            extra: 'Extra',
          }),
        },
        [MatchingTranslations],
        {},
        { MatchingTranslations: { enabled: true, requireOther } },
      );
      expect(offenses).to.have.length(requireOther ? 3 : 2);
      expect(offenses).to.containOffense({
        message: "The translation for 'title' is missing",
        uri: 'file:///locales/fr.json',
      });
      expect(offenses).to.containOffense({
        message: "A default translation for 'extra' does not exist",
        uri: 'file:///locales/fr.json',
      });
    },
  );

  it('should report offenses when the translation file is missing a key', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: 'Hello',
          world: 'World',
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: 'Olá',
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);

      expect(offenses).to.be.of.length(1);
      expect(offenses).to.containOffense("The translation for 'world' is missing");
    }
  });

  it('should report offenses when the default translation is missing a key', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: 'Hello',
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: 'Olá',
          world: 'Mundo',
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);

      expect(offenses).to.be.of.length(1);
      expect(offenses).to.containOffense("A default translation for 'world' does not exist");
      expect(offenses[0]!).to.suggest(
        theme[`locales/pt-BR${prefix}.json`],
        'Delete unneeded translation key',
        {
          startIndex: 0,
          endIndex: theme[`locales/pt-BR${prefix}.json`].length,
          insert: prettyJSON({
            hello: 'Olá',
          }),
        },
      );
    }
  });

  it('should report offenses when nested translation keys do not exist', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: { world: 'Hello, world!' },
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: {},
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);

      expect(offenses).to.be.of.length(1);
      expect(offenses).to.containOffense({
        message: "The translation for 'hello.world' is missing",
        uri: `file:///locales/pt-BR${prefix}.json`,
      });

      const fixed = await autofix(theme, offenses);
      expect(fixed[`locales/pt-BR${prefix}.json`]).to.eql(
        prettyJSON({
          hello: {
            world: 'TODO',
          },
        }),
      );
    }
  });

  it('should report offenses when translation shapes do not match', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: { world: 'Hello, world!' },
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: 'Olá',
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);

      expect(offenses).to.be.of.length(2);
      expect(offenses).to.containOffense({
        message: "A default translation for 'hello' does not exist",
        uri: `file:///locales/pt-BR${prefix}.json`,
      });
      expect(offenses).to.containOffense({
        message: "The translation for 'hello.world' is missing",
        uri: `file:///locales/pt-BR${prefix}.json`,
      });

      const fixed = await autofix(theme, offenses);

      expect(fixed[`locales/pt-BR${prefix}.json`]).to.eql(
        prettyJSON({
          hello: { world: 'TODO' },
        }),
      );
    }
  });

  it('should report offenses when nested translation keys do not match', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: { world: 'Hello, world!' },
        }),
        [`locales/fr${prefix}.json`]: JSON.stringify({
          hello: { monde: 'Bonjour, monde' },
        }),
        [`locales/es-ES${prefix}.json`]: JSON.stringify({
          hello: { world: 'Hello, world!', mundo: { hola: '¡Hola, mundo!' } },
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);

      expect(offenses).to.be.of.length(3);
      expect(offenses).to.containOffense({
        message: "A default translation for 'hello.monde' does not exist",
        uri: `file:///locales/fr${prefix}.json`,
      });
      expect(offenses).to.containOffense({
        message: "A default translation for 'hello.mundo.hola' does not exist",
        uri: `file:///locales/es-ES${prefix}.json`,
      });
      expect(offenses).to.containOffense({
        message: "The translation for 'hello.world' is missing",
        uri: `file:///locales/fr${prefix}.json`,
      });

      const fixed = await autofix(theme, offenses);
      expect(fixed[`locales/fr${prefix}.json`]).to.eql(
        prettyJSON({
          hello: { monde: 'Bonjour, monde', world: 'TODO' },
        }),
      );

      // Default does not exist should be a suggestion and not autofixed.
      expect(fixed[`locales/es-ES${prefix}.json`]).to.eql(theme[`locales/es-ES${prefix}.json`]);
    }
  });

  it('should not report offenses when default translations do not exist', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en${prefix}.json`]: JSON.stringify({
          hello: 'Hello',
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: 'Olá',
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);

      expect(offenses).to.be.of.length(0);
    }
  });

  it('should not report offenses when translations match', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: 'Hello',
          world: 'World',
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: 'Olá',
          world: 'Mundo',
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);

      expect(offenses).to.be.of.length(0);
    }
  });

  it('should not report offenses when nested translations match', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: { world: 'Hello, world!' },
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: { world: 'Olá, mundo!' },
        }),
        [`locales/fr${prefix}.json`]: JSON.stringify({
          hello: { world: 'Bonjour, monde' },
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);

      expect(offenses).to.be.of.length(0);
    }
  });

  it('should not report offenses and ignore pluralization', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: {
            one: 'Hello, you',
            other: "Hello, y'all",
          },
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: {
            zero: 'Estou sozinho :(',
            few: 'Olá, galerinha :)',
          },
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);

      expect(offenses).to.be.of.length(0);
    }
  });

  it('should not report offenses and ignore keys provided by Shopify', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: 'Hello',
          shopify: {
            checkout: {
              general: {
                page_title: 'Checkout',
              },
            },
          },
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: 'Olá',
          shopify: {
            sentence: {
              words_connector: 'hello world',
            },
          },
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);

      expect(offenses).to.be.of.length(0);
    }
  });

  it('should not report offenses and ignore keys provided by customer accounts', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: 'Hello',
          customer_accounts: {
            order: {
              title: 'Order',
            },
          },
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: 'Olá',
          customer_accounts: {
            profile: {
              title: 'Perfil',
            },
          },
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);

      expect(offenses).to.be.of.length(0);
    }
  });

  it('should not report offenses and ignore "*.schema.json" files', async () => {
    const theme = {
      'locales/en.default.json': JSON.stringify({ hello: 'Hello' }),
      'locales/pt-BR.schema.json': JSON.stringify({}),
    };

    const offenses = await check(theme, [MatchingTranslations]);

    expect(offenses).to.be.of.length(0);
  });

  it('should highlight the proper element when the translation file is missing a key', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: 'Hello',
          world: 'World',
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: 'Olá',
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);
      const elements = highlightedOffenses(theme, offenses);

      expect(elements).to.deep.eq(['{"hello":"Olá"}']);
    }
  });

  it('should highlight the proper element when the default translation is missing a key', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: 'Hello',
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: 'Olá',
          world: 'Mundo',
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);
      const elements = highlightedOffenses(theme, offenses);

      expect(elements).to.deep.eq(['"world":"Mundo"']);
    }
  });

  it('should highlight the proper element when nested translation keys do not exist', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: {
            world: 'Hello, world!',
          },
          welcome: 'Welcome',
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: {},
          welcome: 'Bem-vinda',
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);
      const elements = highlightedOffenses(theme, offenses);

      expect(elements).to.deep.eq(['"hello":{}']);
    }
  });

  it('should highlight the proper element when nested translation keys do not exist and there is a sibling node', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: {
            shopify: 'Shopify!',
            world: 'Hello, world!',
          },
          welcome: 'Welcome',
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: {
            shopify: 'Shopify!',
          },
          welcome: 'Bem-vinda',
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);
      const elements = highlightedOffenses(theme, offenses);

      expect(elements).to.deep.eq(['"hello":{"shopify":"Shopify!"}']);
    }
  });

  it('should highlight the proper element when translation shapes do not match', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: { world: 'Hello, world!' },
        }),
        [`locales/pt-BR${prefix}.json`]: JSON.stringify({
          hello: 'Olá',
        }),
      };

      const offenses = await check(theme, [MatchingTranslations]);
      const elements = highlightedOffenses(theme, offenses);

      // We have two elements because we have two offenses:
      // - A default translation for 'hello' does not exist"
      // - The translation for 'hello.world' is missing"
      expect(elements).to.deep.eq(['"hello":"Olá"', '"hello":"Olá"']);
    }
  });

  it('should not highlight anything if the file is unparseable', async () => {
    for (const prefix of ['', '.schema']) {
      const theme = {
        [`locales/en.default${prefix}.json`]: JSON.stringify({
          hello: { world: 'Hello, world!' },
        }),
        [`locales/pt-BR${prefix}.json`]: `{"hello": }`,
      };

      const offenses = await check(theme, [MatchingTranslations]);
      expect(offenses).to.have.length(0);
    }
  });
});
