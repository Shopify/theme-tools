/*
 * Synthetic parity inputs that the frozen corpus does not hold.
 *
 * They reach document-level paths no corpus input reaches: tag lookups keyed
 * by an `Object.prototype` name, and JS whitespace, line-terminator and
 * case-folding rules. Adding them to the corpus would change the frozen
 * digest, so they live here.
 *
 * | Mode | Assertion per input and config                                      |
 * |------|---------------------------------------------------------------------|
 * | TS   | two parses give equal canonical outcomes                            |
 * | Rust | the outcome equals the TS outcome, `parses` goes up by exactly 1,   |
 * |      | and no fallback count moves                                         |
 *
 * The `toLiquidHtmlAST` test also asserts each input's `check` on the TS
 * outcome of the `default` config, so every input is proven to reach its
 * site. Each test fails once, listing every failing input id, sorted.
 */
import { describe, expect, it } from 'vitest';
import {
  toLiquidAST,
  toLiquidHtmlAST,
  toTolerantLiquidAST,
  toTolerantLiquidHtmlAST,
} from '../index';
import type { ASTBuildOptions } from '../index';
import { BACKEND_KEY } from '../backend';
import type { ParserBackend } from '../backend';
import { TagKind } from '../tag-definitions';
import type { TagDefinition } from '../tag-definitions';
import { builtinTags } from '../tags';
import { canonicalOutcome, describeThrow, nodesOf, withoutBackend } from './outcome';
import type { Outcome } from './outcome';

type Parse = (source: string, options?: ASTBuildOptions) => unknown;

type Match = Record<string, unknown>;

type Check =
  | { kind: 'throws'; ctor: string; message?: string }
  | { kind: 'hasNode'; match: Match }
  | { kind: 'noNode'; match: Match }
  | { kind: 'hasUndefinedKey'; match: Match; key: string };

interface Input {
  id: string;
  source: string;
  check?: Check;
}

const ENTRIES: [string, Parse][] = [
  ['toLiquidHtmlAST', toLiquidHtmlAST],
  ['toLiquidAST', toLiquidAST],
  ['toTolerantLiquidHtmlAST', toTolerantLiquidHtmlAST],
  ['toTolerantLiquidAST', toTolerantLiquidAST],
];

const CHECKED_ENTRY = 'toLiquidHtmlAST';

const CONFIGS: [string, ASTBuildOptions | undefined][] = [
  ['default', undefined],
  ['closed', { allowUnclosedDocumentNode: false, mode: 'tolerant' }],
  ['unclosed', { allowUnclosedDocumentNode: true, mode: 'tolerant' }],
  ['strict', { allowUnclosedDocumentNode: false, mode: 'strict' }],
  ['completion', { allowUnclosedDocumentNode: true, mode: 'completion' }],
];

const throws = (ctor: string, message?: string): Check => ({ kind: 'throws', ctor, message });
const hasNode = (match: Match): Check => ({ kind: 'hasNode', match });
const noNode = (match: Match): Check => ({ kind: 'noNode', match });
const hasUndefinedKey = (match: Match, key: string): Check => ({
  kind: 'hasUndefinedKey',
  match,
  key,
});

const FIXED_INPUTS: Input[] = [
  { id: 'output-constructor', source: '{{ constructor }}' },
  { id: 'output-proto', source: '{{ __proto__ }}' },
  { id: 'output-proto-twice', source: '{{ __proto__ | default: __proto__ }}' },
  { id: 'output-filter-arg', source: '{{ toString | append: valueOf }}' },
  { id: 'tag-proto-with-markup', source: '{% hasOwnProperty x %}' },
  { id: 'end-inside-block', source: '{% if a %}{% endtoString %}{% endif %}' },
  { id: 'liquid-line', source: '{% liquid\n  constructor\n  echo valueOf\n%}' },
  { id: 'liquid-line-end', source: '{% liquid\n  if a\n  endisPrototypeOf\n  endif\n%}' },
  { id: 'html-attr', source: '<div class="{% constructor %}">{{ __proto__ }}</div>' },
];

const J_INPUTS: Input[] = [
  {
    id: 'j1-tag-bom',
    source: '{% echo\uFEFFa %}',
    check: hasNode({ type: 'LiquidTag', name: 'echo' }),
  },
  {
    id: 'j1-tag-nel',
    source: '{% echo\u0085a %}',
    check: hasNode({ type: 'LiquidTag', name: 'echo\u0085a' }),
  },
  {
    id: 'j1-text-bom',
    source: '<p>\uFEFF</p>',
    check: noNode({ type: 'TextNode', value: '\uFEFF' }),
  },
  {
    id: 'j1-text-nel',
    source: '<p>\u0085</p>',
    check: hasNode({ type: 'TextNode', value: '\u0085' }),
  },
  {
    id: 'j1-raw-close-bom',
    source: '<script>x</script\uFEFF>',
    check: hasNode({ type: 'HtmlRawNode' }),
  },
  {
    id: 'j1-raw-close-nel',
    source: '<script>x</script\u0085>',
    check: throws('LiquidHTMLASTParsingError'),
  },
  {
    id: 'j1-line-bom',
    source: '{% liquid\n\uFEFFecho a\n%}',
    check: hasNode({ type: 'LiquidTag', name: 'echo' }),
  },
  {
    id: 'j1-line-nel',
    source: '{% liquid\n\u0085echo a\n%}',
    check: hasNode({ type: 'LiquidTag', name: '\u0085echo' }),
  },
  {
    id: 'j1-filter-bom',
    source: '{{ a | upcase:\uFEFF }}',
    check: hasNode({ type: 'LiquidFilter', name: 'upcase' }),
  },
  {
    id: 'j1-raw-end-ideographic',
    source: '{% raw %}x{%\u3000endraw\u3000%}',
    check: hasNode({ type: 'LiquidRawTag', name: 'raw' }),
  },
  {
    id: 'j1-raw-end-nel',
    source: '{% raw %}x{%\u0085endraw%}',
    check: throws('LiquidHTMLASTParsingError'),
  },
  {
    id: 'j2-doctype-cr',
    source: '<!doctype html a\rb>',
    check: hasNode({ type: 'HtmlDoctype', legacyDoctypeString: 'a' }),
  },
  {
    id: 'j2-doctype-ls',
    source: '<!doctype html a\u2028b>',
    check: hasNode({ type: 'HtmlDoctype', legacyDoctypeString: 'a' }),
  },
  {
    id: 'j2-doctype-nel',
    source: '<!doctype html\u0085a>',
    check: hasNode({ type: 'HtmlDoctype', legacyDoctypeString: '\u0085a' }),
  },
  {
    id: 'j2-doctype-case',
    source: '<!DocType HTML a>',
    check: hasNode({ type: 'HtmlDoctype', legacyDoctypeString: 'a' }),
  },
  { id: 'j3-void-kelvin', source: '<lin\u212A>', check: hasNode({ type: 'HtmlVoidElement' }) },
  { id: 'j3-void-upper', source: '<IMG>', check: hasNode({ type: 'HtmlVoidElement' }) },
  { id: 'j3-raw-upper', source: '<SCRIPT>x</SCRIPT>', check: hasNode({ type: 'HtmlRawNode' }) },
  {
    id: 'j3-attr-upper',
    source: '<script TYPE="text/html">x</script>',
    check: hasNode({ type: 'RawMarkup', kind: 'html' }),
  },
  {
    id: 'j4-comment-nonascii',
    source: '{%# \u00E9 %}',
    check: hasNode({ type: 'LiquidTag', name: '#' }),
  },
  {
    id: 'j4-text-ideographic',
    source: '<p>\u3000a</p>',
    check: hasNode({ type: 'TextNode', value: 'a' }),
  },
  {
    id: 'j4-astral',
    source: '<p>\u{1F600}{{ a }}\u00E9</p>',
    check: hasNode({ type: 'LiquidVariableOutput' }),
  },
  {
    id: 'j4-line-nonascii',
    source: "{% liquid\n  echo '\u00E9'\n  echo b\n%}",
    check: hasNode({ type: 'LiquidTag', name: 'echo' }),
  },
  {
    id: 'j5-raw-body',
    source: '{% raw %}\u00E9{% endraw %}x',
    check: hasNode({ type: 'LiquidRawTag', name: 'raw' }),
  },
  {
    id: 'j5-comment-nested',
    source: '{% comment %}\u00E9{% comment %}\u00FC{% endcomment %}\u00F6{% endcomment %}x',
    check: hasNode({ type: 'LiquidRawTag', name: 'comment' }),
  },
  {
    id: 'j5-script-body',
    source: '<script>\u00E9</script>x',
    check: hasNode({ type: 'HtmlRawNode' }),
  },
  {
    id: 'j2-close-ws-bom',
    source: '<p>x</p\uFEFF>',
    check: hasNode({ type: 'HtmlElement' }),
  },
  {
    id: 'j2-close-ws-nel',
    source: '<p>x</p\u0085>',
    check: throws('LiquidHTMLASTParsingError'),
  },
  {
    id: 'j4-line-raw-end-comment',
    source: '{% liquid\n comment\u3000\n x\n endcomment\n%}',
    check: hasNode({ type: 'RawMarkup', value: '\n x\n ' }),
  },
  {
    id: 'j4-line-raw-end-raw',
    source: '{% liquid\n raw\u3000\n x\n endraw\n%}',
    check: hasNode({ type: 'LiquidRawTag', name: 'raw' }),
  },
  {
    id: 'pe-line-if',
    source: '{% liquid\n if a %}',
    check: hasNode({
      type: 'LiquidTag',
      name: 'liquid',
      reason: "Unclosed block tag 'if' in {% liquid %} block",
    }),
  },
  {
    id: 'j6-word-after-name',
    source: '{% comment %}a{% endcomment\u00E9 %}b{% endcomment %}',
    check: hasNode({ type: 'LiquidRawTag', name: 'comment' }),
  },
  {
    id: 'j8-echo-empty',
    source: '{% echo %}',
    check: hasUndefinedKey({ type: 'LiquidTag', name: 'echo' }, 'children'),
  },
  {
    id: 'jd-trim-bom',
    source: '{% doc %}\uFEFF@param x - y{% enddoc %}',
    check: hasNode({ type: 'LiquidDocParamNode' }),
  },
  {
    id: 'jd-trim-start-ls',
    source: '{% doc %}\u2028@param y{% enddoc %}',
    check: hasNode({ type: 'TextNode', value: '@param y' }),
  },
  {
    id: 'jd-lineterm-ls',
    source: '{% doc %}x\u2028@param y{% enddoc %}',
    check: hasNode({ type: 'TextNode', value: 'x\u2028@param y' }),
  },
];

/* Read at run time, so a key a future engine adds gets its own inputs. */
const PROTOTYPE_KEYS = Reflect.ownKeys(Object.prototype).filter(
  (key): key is string => typeof key === 'string',
);

const RAW_TAG_NAMES = Object.keys(builtinTags).filter(
  (name) => (builtinTags as Record<string, TagDefinition>)[name].kind === TagKind.Raw,
);

const LOOKUP_INPUTS: Input[] = [
  ...PROTOTYPE_KEYS.map((k) => ({
    id: `tag-${k}`,
    source: `{% ${k} %}`,
    check: throws('Error', 'Unexpected object: undefined'),
  })),
  ...PROTOTYPE_KEYS.map((k) => ({
    id: `end-${k}`,
    source: `{% end${k} %}`,
    check: throws(
      'LiquidHTMLASTParsingError',
      `Attempting to close LiquidTag '${k}' before it was opened without a matching '${k}'`,
    ),
  })),
  ...PROTOTYPE_KEYS.map((k) => ({
    id: `line-${k}`,
    source: `{% liquid\n  ${k}\n%}`,
    check: hasNode({ type: 'LiquidTag', name: 'liquid', reason: 'Unexpected object: undefined' }),
  })),
  ...PROTOTYPE_KEYS.map((k) => ({
    id: `capture-end-${k}`,
    source: `{% capture x %}{% end${k} %}{% endcapture %}`,
    check: throws(
      'LiquidHTMLASTParsingError',
      `Attempting to close LiquidTag '${k}' before LiquidTag 'capture' was closed`,
    ),
  })),
  ...PROTOTYPE_KEYS.map((k) => ({
    id: `if-end-${k}`,
    source: `{% if a %}{% end${k} %}{% endif %}`,
    check: throws(
      'LiquidHTMLASTParsingError',
      `Attempting to close LiquidTag '${k}' before LiquidTag 'if' was closed`,
    ),
  })),
];

const RAW_INPUTS: Input[] = RAW_TAG_NAMES.map((n) => ({
  id: `raw-${n}`,
  source: `{% ${n} %}\u00E9{% end${n} %}`,
  check: hasNode({ type: 'LiquidRawTag', name: n }),
}));

const INPUTS: Input[] = [...FIXED_INPUTS, ...J_INPUTS, ...LOOKUP_INPUTS, ...RAW_INPUTS];

console.log(
  `Synthetic runtime inputs: ${LOOKUP_INPUTS.length + RAW_INPUTS.length} (${
    LOOKUP_INPUTS.length
  } lookup-family, ${RAW_INPUTS.length} raw-<n>), total inputs ${INPUTS.length}`,
);

describe('synthetic parity inputs', () => {
  for (const [entry, parse] of ENTRIES) {
    it(`synthetic inputs match TS: ${entry}`, () => {
      const failing = new Set<string>();
      for (const input of INPUTS) {
        if (entry === CHECKED_ENTRY && !checkHolds(parse, input)) failing.add(input.id);
        for (const [config, options] of CONFIGS) {
          const detail = compareInput(parse, input.source, options);
          if (detail === undefined) continue;
          console.error(`MISMATCH ${input.id} ${entry} ${config}: ${detail}`);
          failing.add(input.id);
        }
      }
      const ids = [...failing].sort();
      expect(ids, `failing ids: ${ids.join(', ')}`).toEqual([]);
    });
  }
});

/* The check runs on the TS outcome, so in Rust mode it bypasses the backend. */
function checkHolds(parse: Parse, input: Input): boolean {
  if (!input.check) return true;
  const outcome = withoutBackend(() => run(parse, input.source, undefined));
  if (checkOutcome(input.check, outcome)) return true;
  console.error(
    `CHECK FAIL ${input.id}: ${JSON.stringify(input.check)}, TS gave ${
      outcome.threw ? `threw ${describeThrow(outcome.value)}` : 'a returned value'
    }`,
  );
  return false;
}

function checkOutcome(check: Check, outcome: Outcome): boolean {
  if (check.kind === 'throws') return threwWith(outcome, check.ctor, check.message);
  if (outcome.threw) return false;
  const nodes = nodesOf(outcome.value);
  if (check.kind === 'hasNode') return nodes.some((node) => matches(node, check.match));
  if (check.kind === 'noNode') return !nodes.some((node) => matches(node, check.match));
  return nodes.some(
    (node) =>
      matches(node, check.match) && Object.hasOwn(node, check.key) && node[check.key] === undefined,
  );
}

function threwWith(outcome: Outcome, ctor: string, message: string | undefined): boolean {
  if (!outcome.threw) return false;
  const error = outcome.value as { constructor?: { name?: string }; message?: unknown };
  if (error?.constructor?.name !== ctor) return false;
  return message === undefined || error.message === message;
}

function matches(node: Record<string, unknown>, match: Match): boolean {
  return Object.entries(match).every(([key, value]) => node[key] === value);
}

/* Returns a mismatch description, or `undefined` when the input passes. */
function compareInput(
  parse: Parse,
  source: string,
  options: ASTBuildOptions | undefined,
): string | undefined {
  const backend = registeredBackend();
  if (!backend) return compareTsStable(parse, source, options);
  return compareRust(backend, parse, source, options);
}

function compareTsStable(
  parse: Parse,
  source: string,
  options: ASTBuildOptions | undefined,
): string | undefined {
  const first = canonicalOutcome(run(parse, source, options), source);
  const second = canonicalOutcome(run(parse, source, options), source);
  return first === second ? undefined : 'two TS parses differ';
}

function compareRust(
  backend: ParserBackend,
  parse: Parse,
  source: string,
  options: ASTBuildOptions | undefined,
): string | undefined {
  const before = snapshot(backend);
  const rustOutcome = run(parse, source, options);
  const after = snapshot(backend);
  const rust = canonicalOutcome(rustOutcome, source);
  const tsOutcome = withoutBackend(() => run(parse, source, options));
  const ts = canonicalOutcome(tsOutcome, source);

  if (after.parses - before.parses !== 1) return `parses moved by ${after.parses - before.parses}`;
  if (after.environment !== before.environment) return 'environment fallback moved';
  if (after.illFormed !== before.illFormed) return 'illFormed fallback moved';
  if (rust === ts) return undefined;
  return `rust ${summary(rustOutcome)} vs ts ${summary(tsOutcome)}`;
}

function snapshot(backend: ParserBackend) {
  return {
    parses: backend.stats.parses,
    environment: backend.stats.fallbacks.environment,
    illFormed: backend.stats.fallbacks.illFormed,
  };
}

function summary(outcome: Outcome): string {
  return outcome.threw ? `threw ${describeThrow(outcome.value)}` : 'returned';
}

function run(parse: Parse, source: string, options: ASTBuildOptions | undefined): Outcome {
  try {
    const value = options === undefined ? parse(source) : parse(source, { ...options });
    return { threw: false, value };
  } catch (error) {
    return { threw: true, value: error };
  }
}

function registeredBackend(): ParserBackend | undefined {
  return (globalThis as Record<symbol, ParserBackend | undefined>)[BACKEND_KEY];
}
