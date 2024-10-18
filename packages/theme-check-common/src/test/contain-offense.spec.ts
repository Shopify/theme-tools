import { expect, describe, it } from 'vitest';
import { Offense, SourceCodeType } from '../types';
import { path } from '..';

const rootUri = 'file:///';

describe('Module: containOffense', () => {
  const offenses: Offense[] = [
    buildOffense(`The translation for 'hello.world' is missing`, 'locales/en.json'),
    buildOffense(`'snippets/missing.liquid' does not exist`, 'layout/theme.liquid'),
  ];

  describe('with string assertions', () => {
    it(`should contain the "The translation for 'hello.world' is missing" string`, () => {
      expect(offenses).to.containOffense(`The translation for 'hello.world' is missing`);
    });

    it(`should not contain the "!!!" string`, () => {
      expect(offenses).to.not.containOffense('!!!');
    });
  });

  describe('with `Offense` assertions', () => {
    it(`should contain the Offense when their messages and absolute paths match`, () => {
      expect(offenses).to.containOffense(
        buildOffense(`The translation for 'hello.world' is missing`, 'locales/en.json'),
      );
    });

    it(`should not contain the Offense when their messages match but absolute paths don't match`, () => {
      expect(offenses).to.not.containOffense(
        buildOffense(`The translation for 'hello.world' is missing`, 'layout/password.liquid'),
      );
    });

    it(`should not contain the Offense when their absolute paths match but messages don't match`, () => {
      expect(offenses).to.not.containOffense(buildOffense('!!!', 'layout/theme.liquid'));
    });

    it(`should not contain the Offense when their absolute paths and messages don't match`, () => {
      expect(offenses).to.not.containOffense(buildOffense('!!!', '!!!.liquid'));
    });

    describe('with `Offense` optional properties', () => {
      it(`should contain the Offense when their all properties match`, () => {
        expect(offenses).to.containOffense({
          message: `The translation for 'hello.world' is missing`,
          uri: 'file:///locales/en.json',
          severity: 0,
        });
      });

      it(`should not contain the Offense when their messages and absolute paths match, but severity doesn't match`, () => {
        expect(offenses).to.not.containOffense({
          message: `The translation for 'hello.world' is missing`,
          uri: 'file:///locales/en.json',
          severity: 1,
        });
      });
    });
  });

  function buildOffense(message: string, relativePath: string): Offense {
    return {
      type: SourceCodeType.LiquidHtml,
      message,
      uri: path.join(rootUri, relativePath),
      check: '',
      severity: 0,
      start: { index: 0, line: 0, character: 0 },
      end: { index: 0, line: 0, character: 0 },
    };
  }
});
