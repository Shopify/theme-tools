import { assert, beforeEach, describe, expect, it } from 'vitest';
import { DefinitionParams, LocationLink } from 'vscode-languageserver-protocol';
import { DocumentManager } from '../../documents';
import { DefinitionProvider } from '../DefinitionProvider';

describe('Module: VariableDefinitionProvider', () => {
  let provider: DefinitionProvider;
  let documentManager: DocumentManager;

  beforeEach(() => {
    documentManager = new DocumentManager();
    provider = new DefinitionProvider(
      documentManager,
      async () => null,
      async () => null,
    );
  });

  it('finds the definition of an assigned variable', async () => {
    const source = '{% assign x = 1 %}{{ x }}';
    //               0123456789012345678901234
    //               assign "x" starts at pos 10 (the "x" in assign markup)
    //               VariableLookup "x" starts at pos 22
    documentManager.open('file:///test.liquid', source, 1);

    const params: DefinitionParams = {
      textDocument: { uri: 'file:///test.liquid' },
      position: { line: 0, character: 22 }, // cursor on {{ x }}
    };

    const result = await provider.definitions(params);

    assert(result);
    expect(result).toHaveLength(1);
    assert(LocationLink.is(result[0]));
    expect(result[0].targetUri).toBe('file:///test.liquid');
    // The target should point to the variable name in the assign tag
    expect(result[0].targetRange).toEqual(result[0].targetSelectionRange);
  });

  it('returns all preceding assigns — single assign yields direct jump', async () => {
    const source = ['{% assign x = 1 %}', '{{ x }}', '{% assign x = 2 %}', '{{ x }}'].join('\n');
    documentManager.open('file:///test.liquid', source, 1);

    // First {{ x }} on line 1 — only one assign before it → single result (direct jump)
    const params1: DefinitionParams = {
      textDocument: { uri: 'file:///test.liquid' },
      position: { line: 1, character: 4 },
    };
    const result1 = await provider.definitions(params1);
    assert(result1);
    expect(result1).toHaveLength(1);
    assert(LocationLink.is(result1[0]));
    expect(result1[0].targetRange.start.line).toBe(0);

    // Second {{ x }} on line 3 — two assigns before it → both returned (peek menu)
    const params2: DefinitionParams = {
      textDocument: { uri: 'file:///test.liquid' },
      position: { line: 3, character: 4 },
    };
    const result2 = await provider.definitions(params2);
    assert(result2);
    expect(result2).toHaveLength(2);
    assert(LocationLink.is(result2[0]));
    assert(LocationLink.is(result2[1]));
    expect(result2[0].targetRange.start.line).toBe(0);
    expect(result2[1].targetRange.start.line).toBe(2);
  });

  it('returns null for global/contextual variables (no assign exists)', async () => {
    const source = '{{ product }}';
    documentManager.open('file:///test.liquid', source, 1);

    const params: DefinitionParams = {
      textDocument: { uri: 'file:///test.liquid' },
      position: { line: 0, character: 5 },
    };

    const result = await provider.definitions(params);
    assert(result === null);
  });

  it('returns null for unknown variables with no definition', async () => {
    const source = '{{ unknown }}';
    documentManager.open('file:///test.liquid', source, 1);

    const params: DefinitionParams = {
      textDocument: { uri: 'file:///test.liquid' },
      position: { line: 0, character: 5 },
    };

    const result = await provider.definitions(params);
    assert(result === null);
  });

  it('returns null for VariableLookup with null name (global access)', async () => {
    // {{ ['product'] }} has a VariableLookup with name = null
    const source = "{{ ['product'] }}";
    documentManager.open('file:///test.liquid', source, 1);

    // Offset 14 hits the VariableLookup(name=null) at position {3,14}
    const params: DefinitionParams = {
      textDocument: { uri: 'file:///test.liquid' },
      position: { line: 0, character: 14 },
    };

    const result = await provider.definitions(params);
    assert(result === null);
  });

  it('returns null when cursor is on a non-VariableLookup node', async () => {
    const source = '{% assign x = "hello" %}';
    documentManager.open('file:///test.liquid', source, 1);

    const params: DefinitionParams = {
      textDocument: { uri: 'file:///test.liquid' },
      position: { line: 0, character: 16 }, // on the string "hello"
    };

    const result = await provider.definitions(params);
    assert(result === null);
  });

  it('returns null when variable is used before any assign', async () => {
    const source = ['{{ x }}', '{% assign x = 1 %}'].join('\n');
    documentManager.open('file:///test.liquid', source, 1);

    // character 4 = end of 'x' in {{ x }}, lands on VariableLookup
    const params: DefinitionParams = {
      textDocument: { uri: 'file:///test.liquid' },
      position: { line: 0, character: 4 },
    };

    const result = await provider.definitions(params);
    assert(result === null);
  });

  it('works with variables used in filters', async () => {
    const source = ['{% assign greeting = "hello" %}', '{{ greeting | upcase }}'].join('\n');
    documentManager.open('file:///test.liquid', source, 1);

    const params: DefinitionParams = {
      textDocument: { uri: 'file:///test.liquid' },
      position: { line: 1, character: 5 }, // cursor on "greeting" in {{ greeting | upcase }}
    };

    const result = await provider.definitions(params);
    assert(result);
    expect(result).toHaveLength(1);
    assert(LocationLink.is(result[0]));
    expect(result[0].targetRange.start.line).toBe(0);
  });

  it('returns all branch assigns for conditional assignment', async () => {
    const source = [
      '{% if condition %}',
      '  {% assign x = "from if" %}',
      '{% else %}',
      '  {% assign x = "from else" %}',
      '{% endif %}',
      '{{ x }}',
    ].join('\n');
    documentManager.open('file:///test.liquid', source, 1);

    const params: DefinitionParams = {
      textDocument: { uri: 'file:///test.liquid' },
      position: { line: 5, character: 4 },
    };

    const result = await provider.definitions(params);
    assert(result);
    // Both branch assigns are returned — editor shows peek menu
    expect(result).toHaveLength(2);
    assert(LocationLink.is(result[0]));
    assert(LocationLink.is(result[1]));
    expect(result[0].targetRange.start.line).toBe(1);
    expect(result[1].targetRange.start.line).toBe(3);
  });

  it('distinguishes between different variable names', async () => {
    const source = ['{% assign foo = 1 %}', '{% assign bar = 2 %}', '{{ foo }}', '{{ bar }}'].join(
      '\n',
    );
    documentManager.open('file:///test.liquid', source, 1);

    // {{ foo }} should jump to assign foo (line 0)
    const paramsFoo: DefinitionParams = {
      textDocument: { uri: 'file:///test.liquid' },
      position: { line: 2, character: 4 },
    };
    const resultFoo = await provider.definitions(paramsFoo);
    assert(resultFoo);
    expect(resultFoo).toHaveLength(1);
    assert(LocationLink.is(resultFoo[0]));
    expect(resultFoo[0].targetRange.start.line).toBe(0);

    // {{ bar }} should jump to assign bar (line 1)
    const paramsBar: DefinitionParams = {
      textDocument: { uri: 'file:///test.liquid' },
      position: { line: 3, character: 4 },
    };
    const resultBar = await provider.definitions(paramsBar);
    assert(resultBar);
    expect(resultBar).toHaveLength(1);
    assert(LocationLink.is(resultBar[0]));
    expect(resultBar[0].targetRange.start.line).toBe(1);
  });
});
