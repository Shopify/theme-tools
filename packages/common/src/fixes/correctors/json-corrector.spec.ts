import { expect, describe, it } from 'vitest';
import { JSONCorrector } from './json-corrector';
import { prettyJSON } from '../../test';

describe('Module: JSONCorrector', () => {
  it('should collect add patches and apply them', () => {
    const file = JSON.stringify({
      a: {
        b: 'b',
      },
    });

    const corrector = new JSONCorrector(file);
    corrector.add('a.c', 'c');
    corrector.add('a.d', 'd');

    expect(corrector.fix).to.eql({
      startIndex: 0,
      endIndex: file.length,
      insert: prettyJSON({
        a: {
          b: 'b',
          c: 'c',
          d: 'd',
        },
      }),
    });
  });

  it('should collect add patches that deeply add new properties and apply them', () => {
    const file = JSON.stringify({
      a: {
        b: 'b',
      },
    });

    const corrector = new JSONCorrector(file);
    corrector.add('c.d.e', 'e');
    corrector.add('c.d.f', 'f');

    expect(corrector.fix).to.eql({
      startIndex: 0,
      endIndex: file.length,
      insert: prettyJSON({
        a: {
          b: 'b',
        },
        c: {
          d: {
            e: 'e',
            f: 'f',
          },
        },
      }),
    });
  });

  it('should forcefully replace the wrong type with a new one', () => {
    const file = JSON.stringify({
      a: {
        b: 'b',
      },
    });

    const corrector = new JSONCorrector(file);
    corrector.add('a.b.c', 'c');
    corrector.add('a.b.d', 'd');

    expect(corrector.fix).to.eql({
      startIndex: 0,
      endIndex: file.length,
      insert: prettyJSON({
        a: {
          b: {
            c: 'c',
            d: 'd',
          },
        },
      }),
    });
  });

  it('should remove keys', () => {
    const file = JSON.stringify({
      a: {
        b: 'b',
      },
      c: {
        d: 'd',
        e: 'e',
      },
      f: {
        g: 'g',
      },
    });

    const corrector = new JSONCorrector(file);
    corrector.remove('a.b');
    corrector.remove('c.d');
    corrector.remove('f');

    expect(corrector.fix).to.eql({
      startIndex: 0,
      endIndex: file.length,
      insert: prettyJSON({
        a: {},
        c: { e: 'e' },
      }),
    });
  });
});
