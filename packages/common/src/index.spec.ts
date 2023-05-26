import { expect, describe, it } from 'vitest';
import { check } from './index';

describe('Module: Hello World', () => {
  it('should validate that we can test files', () => {
    expect(check).to.exist;
  });
});
