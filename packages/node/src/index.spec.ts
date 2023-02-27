import { expect } from 'chai';
import { startServer } from './index'

describe('Module: index (server)', () => {
  it('should exist and run', () => {
    expect(startServer).to.exist;
  });
});
