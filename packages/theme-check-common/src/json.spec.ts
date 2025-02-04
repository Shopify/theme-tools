import { describe, it, expect, assert } from 'vitest';
import { nodeAtPath, parseJSON } from './json';
import { toJSONAST } from './to-source-code';

describe('Function: parseJSON', () => {
  it('should parse valid JSON string', () => {
    const jsonString = '{"key": "value"}';
    const result = parseJSON(jsonString);

    expect(result).toEqual({ key: 'value' });
  });

  it('should return an Error for invalid JSON string', () => {
    const jsonString = '{"key": "value"';

    const result = parseJSON(jsonString, undefined, true);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Closing brace `}` expected.');
  });

  it('should not return an Error for invalid JSON string if not strict', () => {
    const jsonString = '{"key": "value"';

    const result = parseJSON(jsonString);

    expect(result).toEqual({ key: 'value' });
  });

  it('should return default value for invalid JSON string when provided', () => {
    const jsonString = '{"key": "value"';
    const defaultValue = { defaultKey: 'defaultValue' };

    const result = parseJSON(jsonString, defaultValue, true);

    expect(result).toEqual(defaultValue);
  });

  it('should parse JSON string with comments if disallowComments is false', () => {
    const jsonString = `{
        // This is a comment
        "key": "value"
        /*
         * This is a multiline comment
         */
      }`;

    const result = parseJSON(jsonString);

    expect(result).toEqual({ key: 'value' });
  });

  it('should handle trailing commas', () => {
    const jsonString = '{"key":["value1","value2",],}';

    const result = parseJSON(jsonString);

    expect(result).toEqual({ key: ['value1', 'value2'] });
  });

  it('should return an Error object if parsing fails', () => {
    const jsonString = '{"key": "value"';

    const result = parseJSON(jsonString, undefined, true);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Closing brace `}` expected.');
  });
});

describe('Function: nodeAtPath', () => {
  it('should return the node at the given object path (basic)', () => {
    const ast = toAST({ key: 'value' });
    assert(!(ast instanceof Error));
    const node = nodeAtPath(ast, ['key']);
    assert(node);
    expect(node.type).to.equal('Literal');
  });

  it('should return the node at a given array path (basic)', () => {
    const ast = toAST(['value1', 'value2']);
    assert(!(ast instanceof Error));
    const node = nodeAtPath(ast, [1]);
    assert(node);
    expect(node.type).to.equal('Literal');
  });

  it('should return deep object nodes', () => {
    const ast = toAST({ key: { nestedKey: 'value' } });
    assert(!(ast instanceof Error));
    const node = nodeAtPath(ast, ['key', 'nestedKey']);
    assert(node);
    assert(node.type === 'Literal');
    expect(node.value).to.equal('value');
  });

  it('should return deep array nodes', () => {
    const ast = toAST({ key: ['value1', 'value2'] });
    assert(!(ast instanceof Error));
    const node = nodeAtPath(ast, ['key', 1]);
    assert(node);
    assert(node.type === 'Literal');
    expect(node.value).to.equal('value2');
  });

  it('should return object nodes inside array', () => {
    const ast = toAST({ key: [{ nestedKey: 'value' }] });
    assert(!(ast instanceof Error));
    const node = nodeAtPath(ast, ['key', 0]);
    assert(node);
    assert(node.type === 'Object');
  });

  it('should return the ndoe for nested object inside array paths', () => {
    const ast = toAST({ key: [{ nestedKey: 'value' }] });
    assert(!(ast instanceof Error));
    const node = nodeAtPath(ast, ['key', 0, 'nestedKey']);
    assert(node);
    assert(node.type === 'Literal');
    expect(node.value).to.equal('value');
  });

  it('should return undefined for invalid paths', () => {
    const ast = toAST({ key: 'value' });
    assert(!(ast instanceof Error));
    const node = nodeAtPath(ast, ['invalidKey']);
    expect(node).to.equal(undefined);
  });

  it('should return undefined for invalid array paths', () => {
    const ast = toAST(['value1', 'value2']);
    assert(!(ast instanceof Error));
    const node = nodeAtPath(ast, [2]);
    expect(node).to.equal(undefined);
  });

  function toAST(jsonObject: any) {
    return toJSONAST(JSON.stringify(jsonObject));
  }
});
