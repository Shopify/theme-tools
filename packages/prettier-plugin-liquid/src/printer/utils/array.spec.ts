import { expect } from 'chai';
import * as array from '~/printer/utils/array';

describe('Module: array', () => {
  describe('Unit: first', () => {
    it('should return the first element of an array', () => {
      expect(array.first(['a', 'b', 'c'])).to.eql('a');
      expect(array.first([])).to.eql(undefined);
    });
  });

  describe('Unit: last', () => {
    it('should return the last element of an array', () => {
      expect(array.last(['a', 'b', 'c'])).to.eql('c');
      expect(array.last([])).to.eql(undefined);
    });
  });

  describe('Unit: intersperse', () => {
    it('should return the array interespersed by the thing delimiter', () => {
      expect(array.intersperse(['a', 'b', 'c'], '-')).to.eql(['a', '-', 'b', '-', 'c']);
      expect(array.intersperse([], '-')).to.eql([]);
    });
  });

  describe('Unit: isEmpty', () => {
    it('should return whether the array is empty or not', () => {
      expect(array.isEmpty(['a', 'b', 'c'])).to.be.false;
      expect(array.isEmpty([])).to.be.true;
    });
  });
});
