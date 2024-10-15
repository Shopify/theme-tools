import { expect, describe, it } from 'vitest';
import { autofix, prettyJSON } from '../test';
import { Offense, SourceCodeType } from '../types';

describe('Module: autofix', () => {
  it('should apply a list of all safe changes', async () => {
    const mockTheme = {
      'a.liquid': 'Banana world',
      'b.json': prettyJSON({ a: 'b' }),
    };

    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        fix: (corrector) => corrector.insert(2, 'nanana'),
        uri: 'file:///a.liquid',
        check: 'Mock Check',
        message: 'Mock check message',
        severity: 0,
        start: { line: 0, character: 0, index: 0 },
        end: { line: 0, character: 0, index: 0 },
      },
      {
        type: SourceCodeType.LiquidHtml,
        suggest: [
          {
            message: 'unsafe change',
            fix: (corrector) => {
              corrector.replace(0, 5, 'nooooo');
            },
          },
        ],
        uri: 'file:///a.liquid',
        check: 'Mock Check',
        message: 'Mock check message',
        severity: 0,
        start: { line: 0, character: 0, index: 0 },
        end: { line: 0, character: 0, index: 0 },
      },
      {
        type: SourceCodeType.JSON,
        fix: (corrector) => {
          corrector.add('a.b.c', 'c');
          corrector.add('a.b.d', 'd');
        },
        uri: 'file:///b.json',
        check: 'Mock Check',
        message: 'Mock check message',
        severity: 0,
        start: { line: 0, character: 0, index: 0 },
        end: { line: 0, character: 0, index: 0 },
      },
      {
        type: SourceCodeType.JSON,
        suggest: [
          {
            message: 'unsafe change',
            fix: (corrector) => {
              corrector.remove('a.b');
            },
          },
        ],
        uri: 'file:///b.json',
        check: 'Mock Check',
        message: 'Mock check message',
        severity: 0,
        start: { line: 0, character: 0, index: 0 },
        end: { line: 0, character: 0, index: 0 },
      },
    ];

    const fixed = await autofix(mockTheme, offenses);
    expect(fixed['a.liquid']).to.eql('Bananananana world');
    expect(fixed['b.json']).to.eql(
      prettyJSON({
        a: {
          b: {
            c: 'c',
            d: 'd',
          },
        },
      }),
    );
  });
});
