/**
 * Pluggable parser backend hook.
 *
 * The four public entry points (`toLiquidHtmlAST`, `toLiquidAST`,
 * `toTolerantLiquidHtmlAST`, `toTolerantLiquidAST`) call `tryBackend` first.
 * When no backend is registered it returns `undefined` and the TS parser runs
 * as before.
 *
 * A backend is registered on `globalThis` rather than in a module variable,
 * because the parser's own tests load `src/` while downstream packages load
 * `dist/`, so one process can hold two instances of this module.
 *
 * A backend returns plain data. This module turns it back into the exact
 * objects the TS parser would produce:
 * - every `source` and `_source` key is set to the input string, so the
 *   values are the input by identity and the key keeps its slot;
 * - `{ [UNDEFINED_KEY]: 0 }` in any slot becomes `undefined`, keeping key order;
 * - `{ [PROTO_KEY]: name }` becomes `({})[name]`, the value a plain object
 *   inherits from `Object.prototype`, such as the `Object` function;
 * - `{ [ALIAS_KEY]: n }` becomes the n-th object or array met in a pre-order
 *   walk of the result in own key order, so shared objects stay shared. The
 *   walk counts no marker kind;
 * - errors are rebuilt with this module instance's own error class, so
 *   `instanceof` and `loc` match the TS parser.
 */

import type { ASTBuildOptions, DocumentNode } from './ast';
import { Environment } from './environment';
import { LiquidHTMLASTParsingError } from './errors';
import type { UnclosedNode } from './errors';

export const BACKEND_KEY = Symbol.for('@shopify/liquid-html-parser/backend');

export const UNDEFINED_KEY = '\u0000undefined';

export const ALIAS_KEY = '\u0000alias';

export const PROTO_KEY = '\u0000proto';

const SOURCE_KEYS = new Set(['source', '_source']);

export type BackendParseKind = 'liquidHtml' | 'liquid' | 'tolerantLiquidHtml' | 'tolerantLiquid';

export type FallbackReason = 'environment' | 'illFormed';

export interface BackendStats {
  parses: number;
  fallbacks: Record<FallbackReason, number>;
}

export interface BackendError {
  ctor: string;
  message: string;
  start: number;
  end: number;
  unclosed: UnclosedNode | null;
}

export type BackendResult = { ok: true; ast: unknown } | { ok: false; error: BackendError };

export interface ParserBackend {
  parse(kind: BackendParseKind, source: string, allowUnclosedDocumentNode: boolean): BackendResult;
  stats: BackendStats;
}

interface Hydration {
  source: string;
  objects: object[];
}

export function tryBackend(
  kind: BackendParseKind,
  source: string,
  options: ASTBuildOptions,
): DocumentNode | undefined {
  const backend = registeredBackend();
  if (!backend) return undefined;

  const reason = fallbackReason(source, options);
  if (reason) {
    backend.stats.fallbacks[reason]++;
    return undefined;
  }

  backend.stats.parses++;
  const result = backend.parse(kind, source, options.allowUnclosedDocumentNode);
  if (!result.ok) throwBackendError(result.error, source);
  return hydrate(result.ast, source) as DocumentNode;
}

function registeredBackend(): ParserBackend | undefined {
  return (globalThis as Record<symbol, ParserBackend | undefined>)[BACKEND_KEY];
}

/*
 * Custom tags carry JS `parse()` callbacks that cannot cross into the
 * backend, and a lone surrogate cannot be encoded without shifting offsets.
 */
function fallbackReason(source: string, options: ASTBuildOptions): FallbackReason | undefined {
  if (options.environment !== undefined) return 'environment';
  if (!Environment.default().isBuiltinOnly()) return 'environment';
  if (!isWellFormed(source)) return 'illFormed';
  return undefined;
}

function isWellFormed(source: string): boolean {
  return (source as string & { isWellFormed(): boolean }).isWellFormed();
}

function throwBackendError(error: BackendError, source: string): never {
  if (error.ctor === 'Error') throw new Error(error.message);
  if (error.ctor !== 'LiquidHTMLASTParsingError') {
    throw new Error(`Unknown parser backend error constructor: ${error.ctor}`);
  }

  const unclosed = hydrate(error.unclosed, source) as UnclosedNode | null;
  throw new LiquidHTMLASTParsingError(
    error.message,
    source,
    error.start,
    error.end,
    unclosed ?? undefined,
  );
}

export function hydrate(value: unknown, source: string): unknown {
  return hydrateValue(value, { source, objects: [] });
}

function hydrateValue(value: unknown, ctx: Hydration): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Object.hasOwn(value, UNDEFINED_KEY)) return undefined;
  if (isProtoKey(value)) return resolveProtoKey(value);
  if (isAlias(value)) return resolveAlias(value, ctx);

  ctx.objects.push(value);
  if (Array.isArray(value)) return hydrateArray(value, ctx);
  return hydrateObject(value as Record<string, unknown>, ctx);
}

function hydrateArray(value: unknown[], ctx: Hydration): unknown[] {
  for (let i = 0; i < value.length; i++) value[i] = hydrateValue(value[i], ctx);
  return value;
}

function hydrateObject(value: Record<string, unknown>, ctx: Hydration): Record<string, unknown> {
  for (const key of Object.keys(value)) {
    value[key] = SOURCE_KEYS.has(key) ? ctx.source : hydrateValue(value[key], ctx);
  }
  return value;
}

function isProtoKey(value: object): value is Record<typeof PROTO_KEY, unknown> {
  return Object.hasOwn(value, PROTO_KEY);
}

function resolveProtoKey(value: Record<typeof PROTO_KEY, unknown>): unknown {
  const name = value[PROTO_KEY];
  if (typeof name !== 'string' || !(name in {})) {
    throw new Error(`Parser backend unknown prototype key: ${name}`);
  }
  return ({} as Record<string, unknown>)[name];
}

function isAlias(value: object): value is Record<typeof ALIAS_KEY, number> {
  return Object.hasOwn(value, ALIAS_KEY);
}

function resolveAlias(value: Record<typeof ALIAS_KEY, number>, ctx: Hydration): object {
  const target = ctx.objects[value[ALIAS_KEY]];
  if (target === undefined) {
    throw new Error(`Parser backend alias to unknown object: ${value[ALIAS_KEY]}`);
  }
  return target;
}
