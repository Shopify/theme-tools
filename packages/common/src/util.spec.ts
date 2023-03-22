import { expect, it, describe } from 'vitest';
import { immutableMapDelete, immutableMapSet } from './util';

describe('Module: util', () => {
  describe('Unit: immutableMapSet', () => {
    it('should exist and run', () => {
      expect(immutableMapSet).to.exist;
    });

    it('should not mutate the previous map', () => {
      const a1 = { version: 1 };
      const a2 = { version: 2 };
      const b = { version: 1000 };

      const map1 = new Map([
        ['a', a1],
        ['b', b],
      ]);
      const map2 = immutableMapSet(map1, 'a', a2);

      expect(map1 === map2).to.be.false;
      // objects are reused
      expect(map1.get('b') === map2.get('b')).to.be.true;
      // map1 wasn't mutated
      expect(map1.get('a') === a1).to.be.true;
      // map2 has the new value
      expect(map2.get('a') === a2).to.be.true;
    });
  });

  describe('Unit: immutableMapDelete', () => {
    it('should exist and run', () => {
      expect(immutableMapDelete).to.exist;
    });

    it('should not mutate the previous map', () => {
      const a1 = { version: 1 };
      const a2 = { version: 2 };
      const b = { version: 1000 };

      const map1 = new Map([
        ['a', a1],
        ['b', b],
      ]);
      const map2 = immutableMapDelete(map1, 'a');

      expect(map1 === map2).to.be.false;
      // map1 wasn't mutated
      expect(map1.get('a') === a1).to.be.true;
      // map2 removed the value
      expect(map2.get('a') === undefined).to.be.true;
    });
  });
});
