import { expect, describe, it } from 'vitest';
import { autofix, check, highlightedOffenses } from '../../test';
import { MatchingTranslations } from '../../checks/matching-translations/index';

const prettyJSON = (json: any) => JSON.stringify(json, null, 2);

describe('Module: MatchingTranslations', async () => {
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
