import { describe, it, expect } from 'vitest';
import { toLiquidHtmlAST } from '../ast';
import type { DocumentNode, LiquidHtmlNode } from '../ast';
import { NodeTypes } from '../types';

const PAIRING = {
  mode: 'strict',
  allowUnclosedDocumentNode: false,
  pairDanglingCloseTags: true,
} as const;
const STRICT = { mode: 'strict', allowUnclosedDocumentNode: false } as const;

/** One line per node: its type, its plain name, and whether it is left open. */
function outline(nodes: LiquidHtmlNode[], depth = 0): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.type === NodeTypes.TextNode) continue;
    const pad = '  '.repeat(depth);
    if (node.type === NodeTypes.HtmlElement) {
      const name = node.name.map((s) => ('value' in s ? s.value : '?')).join('');
      const open = node.blockEndPosition.start === node.blockEndPosition.end ? ' (open)' : '';
      lines.push(`${pad}<${name}>${open}`);
      lines.push(...outline(node.children, depth + 1));
    } else if (node.type === NodeTypes.HtmlDanglingMarkerClose) {
      const name = node.name.map((s) => ('value' in s ? s.value : '?')).join('');
      lines.push(`${pad}</${name}> (dangling)`);
    } else if (node.type === NodeTypes.LiquidTag) {
      lines.push(`${pad}{% ${node.name} %}`);
      if (Array.isArray(node.children)) lines.push(...outline(node.children, depth + 1));
    } else if (node.type === NodeTypes.LiquidBranch) {
      lines.push(`${pad}branch ${node.name ?? '(first)'}`);
      lines.push(...outline(node.children, depth + 1));
    } else if (node.type === NodeTypes.LiquidVariableOutput) {
      lines.push(`${pad}{{ }}`);
    }
  }
  return lines;
}

function parseOutline(source: string): string[] {
  const ast: DocumentNode = toLiquidHtmlAST(source, PAIRING);
  return outline(ast.children);
}

describe('pairDanglingCloseTags', () => {
  const LAYOUT = [
    '<body>',
    '<div id="PageContainer">',
    '{% if a %}',
    '<div id="MainContent" class="x">',
    '{% elsif b %}',
    '<div id="MainContent" class="y">',
    '{% else %}',
    '<div id="MainContent" class="z">',
    '{% endif %}',
    '{{ content_for_layout }}',
    '</div>',
    '</div>',
    '<div class="footer"></div>',
    '</body>',
  ].join('\n');

  it('throws on an element opened in every branch and closed after endif, without the option', () => {
    expect(() => toLiquidHtmlAST(LAYOUT, STRICT)).toThrow(
      "Attempting to close HtmlElement 'div' before HtmlElement 'body' was closed",
    );
  });

  it('parses the close as a dangling marker inside the enclosing element', () => {
    expect(parseOutline(LAYOUT)).toEqual([
      '<body>',
      '  <div>',
      '    {% if %}',
      '      branch (first)',
      '        <div> (open)',
      '      branch elsif',
      '        <div> (open)',
      '      branch else',
      '        <div> (open)',
      '    {{ }}',
      '    </div> (dangling)',
      '  <div>',
    ]);
  });

  it('parses a close at the document level the same way', () => {
    const source = '{% if a %}<div class="x">{% else %}<div class="y">{% endif %}hi</div>';
    expect(() => toLiquidHtmlAST(source, STRICT)).toThrow(
      "Attempting to close HtmlElement 'div' before it was opened",
    );
    expect(parseOutline(source)).toEqual([
      '{% if %}',
      '  branch (first)',
      '    <div> (open)',
      '  branch else',
      '    <div> (open)',
      '</div> (dangling)',
    ]);
  });

  it('parses a close in a loop body the same way', () => {
    const source =
      '<ul>{% for i in (1..2) %}{% if s %}<div class="slide">{% else %}<div class="item">{% endif %}{{ i }}</div>{% endfor %}</ul>';
    expect(() => toLiquidHtmlAST(source, STRICT)).toThrow();
    expect(parseOutline(source)).toEqual([
      '<ul>',
      '  {% for %}',
      '    branch (first)',
      '      {% if %}',
      '        branch (first)',
      '          <div> (open)',
      '        branch else',
      '          <div> (open)',
      '      {{ }}',
      '      </div> (dangling)',
    ]);
  });

  it('pairs one close per element every branch leaves open', () => {
    const source = '<main>{% if a %}<div><p>{% else %}<div><p>{% endif %}x</p></div></main>';
    expect(parseOutline(source)).toEqual([
      '<main>',
      '  {% if %}',
      '    branch (first)',
      '      <div> (open)',
      '        <p> (open)',
      '    branch else',
      '      <div> (open)',
      '        <p> (open)',
      '  </p> (dangling)',
      '  </div> (dangling)',
    ]);
  });

  it('counts a case by its when and else branches, not the text before the first when', () => {
    const source =
      '<main>{% case t %}{% when \'a\' %}<div class="a">{% else %}<div class="b">{% endcase %}x</div></main>';
    expect(parseOutline(source)).toContain('  </div> (dangling)');
  });

  it('does not count a conditional that leaves the element open on only some paths', () => {
    // `{% if c %}<div>{% endif %}` has an empty path, so the `</div>` after it
    // keeps closing `<main>`'s sibling structure as before, and this still throws.
    const source = '<main><section>{% if c %}<div>{% endif %}x</div></section></main>';
    expect(() => toLiquidHtmlAST(source, PAIRING)).toThrow();
  });

  it('keeps closing the enclosing element once the branch-opened elements are closed', () => {
    const source = '<main>{% if a %}<div>{% else %}<div>{% endif %}x</div></main><p>after</p>';
    expect(parseOutline(source)).toEqual([
      '<main>',
      '  {% if %}',
      '    branch (first)',
      '      <div> (open)',
      '    branch else',
      '      <div> (open)',
      '  </div> (dangling)',
      '<p>',
    ]);
  });

  it('does not let an unmatched earlier close cancel an element opened later', () => {
    const source =
      '{% if a %}</div>{% else %}</div>{% endif %}{% if b %}<div>{% else %}<div>{% endif %}x</div>';
    expect(parseOutline(source)).toEqual([
      '{% if %}',
      '  branch (first)',
      '    </div> (dangling)',
      '  branch else',
      '    </div> (dangling)',
      '{% if %}',
      '  branch (first)',
      '    <div> (open)',
      '  branch else',
      '    <div> (open)',
      '</div> (dangling)',
    ]);
  });

  it('does not convert a close that crosses the innermost branch-opened element', () => {
    const source = '{% if a %}<section><div>{% else %}<section><div>{% endif %}</section></div>';
    expect(() => toLiquidHtmlAST(source, PAIRING)).toThrow(
      "Attempting to close HtmlElement 'section' before it was opened",
    );
  });

  it('does not convert a close for an element a branch-opened element sits inside of', () => {
    // The innermost open is `<p>`, so `</div>` is not taken from the branches and
    // closes `<main>`'s `<div>` sibling structure as before, which throws here.
    const source = '<main>{% if a %}<div><p>{% else %}<div><p>{% endif %}x</div></main>';
    expect(() => toLiquidHtmlAST(source, PAIRING)).toThrow();
  });

  it('reads each node of a scope once, however many closes the scope meets', () => {
    const count = 2000;
    const source = `<main>${'{% if a %}<div>{% else %}<div>{% endif %}'.repeat(count)}x${'</div>'.repeat(count)}</main>`;
    const started = performance.now();
    const ast = toLiquidHtmlAST(source, PAIRING);
    expect(performance.now() - started).toBeLessThan(2000);
    const main = ast.children[0] as { children: LiquidHtmlNode[] };
    const closes = main.children.filter((n) => n.type === NodeTypes.HtmlDanglingMarkerClose);
    expect(closes).toHaveLength(count);
  });

  it('leaves a conditional open and close pair to the existing branch markers', () => {
    const source = '<main>{% if c %}<a>{% endif %}x{% if c %}</a>{% endif %}</main>';
    expect(toLiquidHtmlAST(source, PAIRING)).toEqual(toLiquidHtmlAST(source, STRICT));
  });

  it('does not change the AST of a template the strict parse accepts', () => {
    const sources = [
      '<div><span>a</span></div>',
      '{% if a %}<div>{% else %}<div>{% endif %}',
      '<div>{% if a %}<p>{% else %}</p>{% endif %}</div>',
      '{% for x in y %}<li>{{ x }}</li>{% endfor %}',
    ];
    for (const source of sources) {
      expect(toLiquidHtmlAST(source, PAIRING)).toEqual(toLiquidHtmlAST(source, STRICT));
    }
  });
});
