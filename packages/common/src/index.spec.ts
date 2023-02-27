import { expect } from 'chai';
import { check } from './index';

describe('Module: Hello World', () => {
  it('should validate that we can test files', () => {
    expect(check).to.exist;
  });
});
