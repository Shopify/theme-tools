import { expect, describe, it } from 'vitest';
import { getValuesInMarkup } from './utils';

describe('getValuesInMarkup', () => {
  it('should return the values in the markup (one value)', () => {
    const markup = '"123"';
    const values = getValuesInMarkup(markup);
    expect(values).toContainEqual({ value: '"123"', index: 0 });
  });

  it('should return the values in the markup (multiple values)', () => {
    const markup = '"123" 555 text';
    const values = getValuesInMarkup(markup);
    expect(values).toContainEqual({ value: '"123"', index: 0 });
    expect(values).toContainEqual({ value: '555', index: 6 });
    expect(values).toContainEqual({ value: 'text', index: 10 });
  });

  it('should return nothing when no values in the markup', () => {
    const markup = '';
    const values = getValuesInMarkup(markup);
    expect(values).to.have.length(0);
  });

  it('should return nothing when only spaces in the markup', () => {
    const markup = '     ';
    const values = getValuesInMarkup(markup);
    expect(values).to.have.length(0);
  });
});
