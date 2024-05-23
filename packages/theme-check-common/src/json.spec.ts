import { describe, it, expect } from 'vitest';
import { parseJSON } from './json';

describe('Function: parseJSON', () => {
  it('should parse valid JSON string', () => {
    const jsonString = '{"key": "value"}';
    const result = parseJSON(jsonString);

    expect(result).toEqual({ key: 'value' });
  });

  it('should return an Error for invalid JSON string', () => {
    const jsonString = '{"key": "value"';

    const result = parseJSON(jsonString);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Closing brace `}` expected.');
  });

  it('should return default value for invalid JSON string when provided', () => {
    const jsonString = '{"key": "value"';
    const defaultValue = { defaultKey: 'defaultValue' };

    const result = parseJSON(jsonString, defaultValue);

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

    const result = parseJSON(jsonString);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Closing brace `}` expected.');
  });
});
