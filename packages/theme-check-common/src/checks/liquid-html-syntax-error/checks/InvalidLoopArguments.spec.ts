import { expect, describe, it } from 'vitest';
import { applyFix, runLiquidCheck } from '../../../test';
import { LiquidHTMLSyntaxError } from '../index';

describe('detectInvalidLoopArguments', async () => {
  it('should not report when args are valid', async () => {
    const testCases = [
      `{% for i in array reversed %}{% endfor %}`,
      `{% for i in array reversed offset: 1 %}{% endfor %}`,
      `{% tablerow x in array limit: 10 %}{% endtablerow %}`,
      `{% tablerow x in array cols: 2 limit: 10 %}{% endtablerow %}`,
    ];

    for (const sourceCode of testCases) {
      const offenses = await testCheck(sourceCode);
      expect(offenses).to.have.length(0);
    }
  });

  it('should report when invalid args are found', async () => {
    const testCases = [
      [
        `{% for i in array limit1: 10 %}{% endfor %}`,
        '{% for i in array  %}{% endfor %}',
        'limit1: 10',
      ],
      [
        `{% for i in array !! range: (1..2) %}{% endfor %}`,
        '{% for i in array  %}{% endfor %}',
        '!!, range: (1..2)',
      ],
      [
        `{% tablerow i in (1..10) limit1: 10 %}{{ i }}{% endtablerow %}`,
        '{% tablerow i in (1..10)  %}{{ i }}{% endtablerow %}',
        'limit1: 10',
      ],
    ];

    for (const [sourceCode, expected, invalidArguments] of testCases) {
      const offenses = await testCheck(sourceCode);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).toEqual(
        expect.stringContaining(`Invalid/Unknown arguments: ${invalidArguments}`),
      );

      const fixed = applyFix(sourceCode, offenses[0]);
      expect(fixed).to.equal(expected);
    }
  });

  it('should report when positional args are found after named/invalid args', async () => {
    const testCases = [
      [
        `{% for i in array limit: 10 reversed %}{% endfor %}`,
        '{% for i in array limit: 10 %}{% endfor %}',
        'reversed',
      ],
      [
        `{% for i in array reversed limit: 10 invalid %}{% endfor %}`,
        '{% for i in array reversed limit: 10 %}{% endfor %}',
        'invalid',
      ],
      [
        `{% for i in array !! reversed limit: 10 invalid %}{% endfor %}`,
        '{% for i in array limit: 10 %}{% endfor %}',
        '!!, reversed, invalid',
      ],
      [
        `{% for i in array reversed: (1..2) %}{% endfor %}`,
        '{% for i in array  %}{% endfor %}',
        'reversed: (1..2)',
      ],
    ];

    for (const [sourceCode, expected, invalidArguments] of testCases) {
      const offenses = await testCheck(sourceCode);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).toEqual(
        expect.stringContaining(`Invalid/Unknown arguments: ${invalidArguments}`),
      );

      const fixed = applyFix(sourceCode, offenses[0]);
      expect(fixed).to.equal(expected);
    }
  });

  it('should report when there are multiple instances of the error', async () => {
    const sourceCode = `{% for i in array reversed limit: 10 invalid %}{% endfor %} {% tablerow x in array cols: 2 limit: 10 invalid %}{% endtablerow %}`;

    const offenses = await testCheck(sourceCode);
    expect(offenses).to.have.length(2);
    for (const offense of offenses) {
      expect(offense.message).toEqual(
        expect.stringContaining(`Invalid/Unknown arguments: invalid`),
      );
    }

    const fixed = applyFix(sourceCode, offenses[0]);
    expect(fixed).to.equal(
      '{% for i in array reversed limit: 10 %}{% endfor %} {% tablerow x in array cols: 2 limit: 10 invalid %}{% endtablerow %}',
    );

    const fixed2 = applyFix(sourceCode, offenses[1]);
    expect(fixed2).to.equal(
      '{% for i in array reversed limit: 10 invalid %}{% endfor %} {% tablerow x in array cols: 2 limit: 10 %}{% endtablerow %}',
    );
  });
});

function testCheck(sourceCode: string) {
  return runLiquidCheck(LiquidHTMLSyntaxError, sourceCode, undefined, {
    themeDocset: {
      tags: () =>
        Promise.resolve([
          {
            name: 'for',
            parameters: [
              {
                name: 'reversed',
                positional: true,
                description: '...',
                required: false,
                types: [],
              },
              { name: 'limit', positional: false, description: '...', required: false, types: [] },
              { name: 'offset', positional: false, description: '...', required: false, types: [] },
            ],
          },
          {
            name: 'tablerow',
            parameters: [
              { name: 'cols', positional: false, description: '...', required: false, types: [] },
              { name: 'limit', positional: false, description: '...', required: false, types: [] },
              { name: 'offset', positional: false, description: '...', required: false, types: [] },
            ],
          },
        ]),
      filters: () => Promise.resolve([]),
      objects: () => Promise.resolve([]),
      liquidDrops: () => Promise.resolve([]),
      systemTranslations: () => Promise.resolve({}),
    },
  });
}
