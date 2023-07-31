const { expect } = require('chai');
const { voidElements, openingLiquidTags } = require('./constants');
const indentationRules = require('./indentation-rules');

describe('Module: indentationRules', () => {
  const increase = new RegExp(indentationRules.increaseIndentPattern, 'im');
  const decrease = new RegExp(indentationRules.decreaseIndentPattern, 'im');

  it('should match non-void elements', () => {
    expect('<html>').to.match(increase);
    expect('</html>').to.match(decrease);
    expect('<any>').to.match(increase);
    expect('</any>').to.match(decrease);
  });

  it('should not match closing tags', () => {
    expect('</html>').not.to.match(increase);
    expect('<html>').not.to.match(decrease);
    expect('</any>').not.to.match(increase);
    expect('<any>').not.to.match(decrease);
  });

  it('should not match void elements', () => {
    voidElements.forEach((voidElement) => {
      expect(`<${voidElement}>`).not.to.match(increase);
      expect(`<${voidElement}/>`).not.to.match(increase);
      expect(`<${voidElement} defer />`).not.to.match(increase);
      expect(`<${voidElement}>`).not.to.match(decrease);
      expect(`<${voidElement}/>`).not.to.match(decrease);
      expect(`<${voidElement} defer />`).not.to.match(decrease);
    });
  });

  it('should match opening liquid tags', () => {
    openingLiquidTags.forEach((tag) => {
      expect(`{% ${tag} %}`).to.match(increase);
      expect(`{% end${tag} %}`).to.match(decrease);
      expect(`{% ${tag} in collection %}`).to.match(increase);
    });
  });

  it('should match on HTML comment start (not closing)', () => {
    expect('<!--').to.match(increase);
    expect('<!-- hello world').to.match(increase);
    expect('-->').to.match(decrease);
  });

  it('should not match closed comments', () => {
    expect('<!-- hello world -->').not.to.match(increase);
    expect('<!-- hello world -->').not.to.match(decrease);
  });

  it('should match on opened tags', () => {
    expect('<html').to.match(increase);
    expect('<html').not.to.match(decrease);
    expect('>').to.match(increase);
    expect('>').to.match(decrease);

    expect('<img').to.match(increase);
    expect('<img').not.to.match(decrease);
    expect('/>').not.to.match(increase);
    expect('/>').to.match(decrease);
  });

  it('should match liquid tag opens', () => {
    expect('{%').to.match(increase);
    expect('{% liquid').to.match(increase);
    expect('{% #').to.match(increase);
    expect('%}').to.match(decrease);
  });

  it('should not match other liquid tags that are closed', () => {
    expect(`{% assign foo = "bar" %}`).not.to.match(increase);
    expect(`{% assign foo = "bar" %}`).not.to.match(decrease);
  });

  it('should match liquid variable opens', () => {
    expect('{{').to.match(increase);
    expect('{{ product').to.match(increase);
    expect('}}').to.match(decrease);
  });

  it('should not match completed liquid variables', () => {
    expect('{{ product }}').not.to.match(increase);
    expect('{{ product }}').not.to.match(decrease);
  });

  it('should match lines ending in braces (JS|CSS)', () => {
    expect('function {').to.match(increase);
    expect('}').to.match(decrease);
    expect('const foo = [').to.match(increase);
    expect(']').to.match(decrease);
    expect('fun(').to.match(increase);
    expect(')').to.match(decrease);
  });
});
