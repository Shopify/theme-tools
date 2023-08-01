import { expect, describe, it } from 'vitest';
import { applyFixToString } from './apply-fix-to-string';

// You'll be happy to note that ChatGPT kind of generated this as well.
describe('Module: applyFixToString', () => {
  it('should apply 1 fix description correctly', () => {
    const source = 'Hello, world!';
    const fixDescriptions = [{ startIndex: 0, endIndex: 5, insert: 'Hi' }];
    const result = applyFixToString(source, fixDescriptions);
    expect(result).to.equal('Hi, world!');
  });

  it('should apply a couple of fix descriptions correctly', () => {
    const source = 'Hello, world!';
    const fixDescriptions = [
      { startIndex: 7, endIndex: 7, insert: 'beautiful ' },
      { startIndex: 12, endIndex: 13, insert: '' },
      { startIndex: 0, endIndex: 5, insert: 'Hi' },
    ];
    const result = applyFixToString(source, fixDescriptions);
    expect(result).to.equal('Hi, beautiful world');
  });

  it('should throw an error for overlapping fix descriptions', () => {
    const source = 'Hello, world!';
    const fixDescriptions = [
      { startIndex: 5, endIndex: 7, insert: 'wonderful ' },
      { startIndex: 6, endIndex: 8, insert: 'beautiful ' },
    ];
    expect(() => applyFixToString(source, fixDescriptions)).to.throw(
      'Overlapping ranges are not allowed',
    );
  });

  it('should not throw an error for fixes ending and starting on the same index', () => {
    const source = 'Hello, world!';
    const fixDescriptions = [
      { startIndex: 6, endIndex: 6, insert: ' wonderful' },
      { startIndex: 6, endIndex: 7, insert: ' and beautiful ' },
    ];
    const result = applyFixToString(source, fixDescriptions);
    expect(result).to.equal('Hello, wonderful and beautiful world!');
  });

  it('should throw an error for fix descriptions going over bounds', () => {
    const source = 'Hello, world!';
    const fixDescriptions = [{ startIndex: 0, endIndex: 20, insert: 'Hi' }];
    expect(() => applyFixToString(source, fixDescriptions)).to.throw(
      'Fix description is going overboard',
    );
  });
});
