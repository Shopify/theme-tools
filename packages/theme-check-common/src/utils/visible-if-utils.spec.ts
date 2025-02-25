import { describe, it, expect, vi } from 'vitest';
import { type LiquidVariableLookup, NodeTypes, type LiquidString } from '@shopify/liquid-html-parser';
import { type Context, SourceCodeType } from '..';
import {
  lookupIsError,
  getVariableLookupsInExpression,
  validateLookup,
  getGlobalSettings,
  type Vars,
} from './visible-if-utils';

describe('Module: visible-if-utils', () => {
  describe('Function: lookupIsError', () => {
    it('returns true for error objects', () => {
      const error = { error: 'some error message' };
      expect(lookupIsError(error)).toBe(true);
    });

    it('returns false for lookup arrays', () => {
      const lookups: LiquidVariableLookup[] = [];
      expect(lookupIsError(lookups)).toBe(false);
    });
  });

  describe('Function: getVariableLookupsInExpression', () => {
    it('returns lookups for valid expressions', () => {
      const result = getVariableLookupsInExpression('{{ settings.foo }}');
      expect(lookupIsError(result)).toBe(false);
      if (!lookupIsError(result)) {
        expect(result[0].name).toBe('settings');
        expect((result[0].lookups[0] as LiquidString).value).toBe('foo');
      }
    });

    it('returns error for invalid expression format', () => {
      const result = getVariableLookupsInExpression('settings.foo');
      expect(lookupIsError(result)).toBe(true);
      if (lookupIsError(result)) {
        expect(result.error).toBe('Invalid visible_if expression. It should take the form "{{ <expression> }}".');
      }
    });

    it('returns error for syntax errors', () => {
      const result = getVariableLookupsInExpression('{{ settings.foo !@# }}');
      expect(lookupIsError(result)).toBe(true);
      if (lookupIsError(result)) {
        expect(result.error).toBe('Syntax error: cannot parse visible_if expression.');
      }
    });

    it('returns error when no variable lookups found', () => {
      const result = getVariableLookupsInExpression('{{ "just a string" }}');
      expect(lookupIsError(result)).toBe(true);
      if (lookupIsError(result)) {
        expect(result.error).toBe('visible_if expression contains no references to any settings. This may be an error.');
      }
    });
  });

  describe('Function: validateLookup', () => {
    const vars: Vars = {
      settings: {
        foo: true,
        bar: {
          baz: true,
        },
      },
    };

    const makeLookup = (name: string, lookups: string[] = []): LiquidVariableLookup => ({
      type: NodeTypes.VariableLookup,
      name,
      lookups: lookups.map(value => ({ type: NodeTypes.String, value } as LiquidString)),
      position: null!,
      source: '',
    });

    it('returns null for valid lookups', () => {
      const lookup = makeLookup('settings', ['foo']);
      expect(validateLookup(lookup, vars)).toBeNull();
    });

    it('returns error for non-existent variables', () => {
      const lookup = makeLookup('settings', ['nonexistent']);
      expect(validateLookup(lookup, vars)).toBe('Invalid variable: "settings.nonexistent" was not found.');
    });

    it('returns error when using variable as namespace', () => {
      const lookup = makeLookup('settings', ['foo', 'invalid']);
      expect(validateLookup(lookup, vars)).toBe(
        'Invalid variable: "settings.foo" refers to a variable, but is being used here as a namespace.',
      );
    });

    it('returns error when using namespace as variable', () => {
      const lookup = makeLookup('settings', ['bar']);
      expect(validateLookup(lookup, vars)).toBe(
        'Invalid variable: "settings.bar" refers to a namespace, but is being used here as a variable.',
      );
    });
  });

  describe('Function: getGlobalSettings', () => {
    const createMockContext = (fsOverrides = {}): Context<SourceCodeType> => ({
      file: {
        uri: 'file:///some/path',
        type: SourceCodeType.JSON,
        source: '',
        ast: new Error(),
      },
      fs: {
        readFile: vi.fn(),
        stat: vi.fn(),
        readDirectory: vi.fn(),
        ...fsOverrides,
      },
      fileExists: vi.fn().mockResolvedValue(true),
    } as unknown as Context<SourceCodeType>);

    it('returns global settings from settings_schema.json', async () => {
      const mockContext = createMockContext({
        readFile: vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              name: 'theme_info',
              theme_name: 'Test Theme',
            },
            {
              name: 'Colors',
              settings: [
                { id: 'color_1', type: 'color' },
                { id: 'color_2', type: 'color' }
              ],
            },
          ]),
        ),
      });

      const settings = await getGlobalSettings(mockContext);
      expect(settings).toEqual([
        { id: 'color_1', type: 'color' },
        { id: 'color_2', type: 'color' }
      ]);
    });

    it('returns empty array when settings_schema.json is not found', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockContext = createMockContext({
        readFile: vi.fn().mockRejectedValue(new Error('File not found')),
      });

      const settings = await getGlobalSettings(mockContext);
      expect(settings).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('handles malformed settings_schema.json', async () => {
      const mockContext = createMockContext({
        readFile: vi.fn().mockResolvedValue('invalid json'),
      });

      const settings = await getGlobalSettings(mockContext);
      expect(settings).toEqual([]);
    });

    it('filters out settings without id or type', async () => {
      const mockContext = createMockContext({
        readFile: vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              name: 'Settings',
              settings: [
                { id: 'valid_1', type: 'text' },
                { id: 'valid_2', type: 'color' },
                { id: 'missing_type' },
                { type: 'missing_id' },
                {}
              ],
            },
          ]),
        ),
      });

      const settings = await getGlobalSettings(mockContext);
      expect(settings).toEqual([
        { id: 'valid_1', type: 'text' },
        { id: 'valid_2', type: 'color' }
      ]);
    });
  });
}); 