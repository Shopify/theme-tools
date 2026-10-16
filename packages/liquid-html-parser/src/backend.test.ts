import { afterEach, describe, expect, it } from 'vitest';
import { toLiquidAST, toLiquidHtmlAST } from './ast';
import {
  ALIAS_KEY,
  BACKEND_KEY,
  UNDEFINED_KEY,
  type BackendResult,
  type ParserBackend,
} from './backend';
import { Environment, TagKind } from './environment';
import { LiquidHTMLASTParsingError, type UnclosedNode } from './errors';
import { builtinTags } from './tags/index';
import { toTolerantLiquidHtmlAST } from './tolerant';
import { NodeTypes } from './types';

const globals = globalThis as Record<symbol, ParserBackend | undefined>;
// Restored after each test, so later files in this worker keep the backend the setup file registered
const priorBackend = globals[BACKEND_KEY];

function registerFake(result: () => BackendResult): ParserBackend {
  const backend: ParserBackend = {
    parse: result,
    stats: { parses: 0, fallbacks: { environment: 0, illFormed: 0 } },
  };
  globals[BACKEND_KEY] = backend;
  return backend;
}

function fakeAst(source: string) {
  return {
    type: 'Document',
    source: 'placeholder',
    _source: 'placeholder',
    children: [
      {
        type: 'TextNode',
        value: source,
        position: { start: 0, end: source.length },
        blockEndPosition: { [UNDEFINED_KEY]: 0 },
        source: 'placeholder',
      },
      { type: 'TextNode', value: source, position: { [ALIAS_KEY]: 3 }, source: 'placeholder' },
    ],
    name: '#document',
    position: { start: 0, end: source.length },
  };
}

afterEach(() => {
  if (priorBackend === undefined) {
    delete globals[BACKEND_KEY];
  } else {
    globals[BACKEND_KEY] = priorBackend;
  }
  Environment.resetDefault();
});

describe('Unit: tryBackend', () => {
  it('re-attaches source by identity and keeps key order', () => {
    const source = 'hello';
    registerFake(() => ({ ok: true, ast: fakeAst(source) }));
    const ast = toLiquidHtmlAST(source) as any;

    expect(Object.keys(ast)).toEqual(['type', 'source', '_source', 'children', 'name', 'position']);
    expect(ast.source).toBe(source);
    expect(ast._source).toBe(source);
    expect(ast.children[0].source).toBe(source);
    expect(Object.keys(ast.children[0])).toEqual([
      'type',
      'value',
      'position',
      'blockEndPosition',
      'source',
    ]);
    expect('blockEndPosition' in ast.children[0]).toBe(true);
    expect(ast.children[0].blockEndPosition).toBeUndefined();
    expect(ast.children[1].position).toBe(ast.children[0].position);
  });

  it('keeps a text value equal to UNDEFINED_KEY as a string', () => {
    const source = UNDEFINED_KEY;
    registerFake(() => ({ ok: true, ast: fakeAst(source) }));
    const ast = toLiquidHtmlAST(source) as any;

    expect(ast.children[0].value).toBe(UNDEFINED_KEY);
    expect(ast.children[1].value).toBe(UNDEFINED_KEY);
  });

  it('resolves an alias placed after an undefined marker to the right object', () => {
    const source = 'hello';
    registerFake(() => ({
      ok: true,
      ast: {
        type: 'Document',
        source: 'placeholder',
        children: [
          {
            type: 'TextNode',
            blockEndPosition: { [UNDEFINED_KEY]: 0 },
            position: { start: 0, end: 5 },
            source: 'placeholder',
          },
          {
            type: 'TextNode',
            blockEndPosition: { [UNDEFINED_KEY]: 0 },
            position: { [ALIAS_KEY]: 3 },
            source: 'placeholder',
          },
        ],
        name: '#document',
      },
    }));
    const ast = toLiquidHtmlAST(source) as any;

    expect(ast.children[0].position).toEqual({ start: 0, end: 5 });
    expect(ast.children[1].position).toBe(ast.children[0].position);
    expect(ast.children[1].blockEndPosition).toBeUndefined();
  });

  it('throws a LiquidHTMLASTParsingError with the same loc and unclosed as TS', () => {
    const source = '{% if a %}\n<div>';
    const unclosed: UnclosedNode = {
      type: NodeTypes.LiquidTag,
      name: 'if',
      blockStartPosition: { start: 0, end: 10 },
    };
    registerFake(() => ({
      ok: false,
      error: { ctor: 'LiquidHTMLASTParsingError', message: 'boom', start: 11, end: 16, unclosed },
    }));
    const expected = new LiquidHTMLASTParsingError('boom', source, 11, 16, unclosed);

    const error = catchError(() => toLiquidHtmlAST(source));

    expect(error).toBeInstanceOf(LiquidHTMLASTParsingError);
    expect(error.name).toBe('LiquidHTMLParsingError');
    expect(error.message).toBe('boom');
    expect(error.loc).toEqual(expected.loc);
    expect(error.unclosed).toEqual(unclosed);
  });

  it('counts an environment fallback when options.environment is set', () => {
    const backend = registerFake(() => ({ ok: true, ast: fakeAst('x') }));
    const environment = new Environment(builtinTags);

    const ast = toLiquidHtmlAST('hi', {
      allowUnclosedDocumentNode: false,
      mode: 'tolerant',
      environment,
    });

    expect(ast.children[0]).toMatchObject({ type: 'TextNode', value: 'hi' });
    expect(backend.stats).toEqual({ parses: 0, fallbacks: { environment: 1, illFormed: 0 } });
  });

  it('counts an environment fallback when the default environment has custom tags', () => {
    const backend = registerFake(() => ({ ok: true, ast: fakeAst('x') }));
    Environment.default().registerTag('custom', { kind: TagKind.Tag, parse: () => undefined });

    toLiquidAST('hi');

    expect(backend.stats).toEqual({ parses: 0, fallbacks: { environment: 1, illFormed: 0 } });
  });

  it('counts an illFormed fallback for a lone surrogate', () => {
    const backend = registerFake(() => ({ ok: true, ast: fakeAst('x') }));

    const ast = toTolerantLiquidHtmlAST('a\uD800b');

    expect(ast.children[0]).toMatchObject({ type: 'TextNode', value: 'a\uD800b' });
    expect(backend.stats).toEqual({ parses: 0, fallbacks: { environment: 0, illFormed: 1 } });
  });
});

describe('Unit: Environment.isBuiltinOnly', () => {
  it('is true on the default environment', () => {
    expect(Environment.default().isBuiltinOnly()).toBe(true);
  });

  it('is false after registerTag', () => {
    const environment = new Environment(builtinTags);
    environment.registerTag('custom', { kind: TagKind.Tag, parse: () => undefined });
    expect(environment.isBuiltinOnly()).toBe(false);
  });

  it('is false for new Environment({})', () => {
    expect(new Environment({}).isBuiltinOnly()).toBe(false);
  });
});

function catchError(fn: () => unknown): any {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected a throw');
}
