import { expect } from 'chai';
import { startServer } from './index';

describe('Module: index (common)', () => {
  it('should exist and run', () => {
    expect(startServer).to.exist;
  });
});
