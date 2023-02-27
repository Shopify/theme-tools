import { expect } from 'chai';
import { startServer } from './index';

describe('Module: index (browser)', () => {
  it('should exist and run', () => {
    expect(startServer).to.exist;
  });
});
