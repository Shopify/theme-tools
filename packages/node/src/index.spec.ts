import { expect } from 'chai';
import sinon from 'sinon';
import { startServer } from './index';

describe('Module: index (server)', () => {
  it('should exist and run', () => {
    expect(startServer).to.exist;
    const spy = sinon.spy();
    expect(spy).not.to.have.been.called;
  });
});
