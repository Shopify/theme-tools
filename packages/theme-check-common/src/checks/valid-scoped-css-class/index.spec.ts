import { expect, describe, it } from 'vitest';
import { ValidScopedCSSClass } from './index';
import { check, runLiquidCheck } from '../../test';

describe('Module: ValidScopedCSSClass', () => {
  const noDeps = {
    getReferences: async () => [] as any[],
    getDependencies: async () => [] as any[],
  };

  describe('local stylesheet scope', () => {
    it('reports no offense when a class is defined in the local stylesheet', async () => {
      const sourceCode = `
        {% stylesheet %}
          .my-class { color: red; }
        {% endstylesheet %}
        <div class="my-class">Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        noDeps,
      );
      expect(offenses).toHaveLength(0);
    });

    it('does not report when a class is not defined anywhere in the theme', async () => {
      const sourceCode = `
        {% stylesheet %}
          .defined-class { color: red; }
        {% endstylesheet %}
        <div class="external-class">Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        noDeps,
      );
      expect(offenses).toHaveLength(0);
    });

    it('reports an offense when a class exists in the theme but is out of scope', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% stylesheet %}
              .local-class { color: red; }
            {% endstylesheet %}
            <div class="other-class">Hello</div>
          `,
          'snippets/other.liquid': `
            {% stylesheet %}
              .other-class { color: blue; }
            {% endstylesheet %}
          `,
        },
        [ValidScopedCSSClass],
        noDeps,
      );

      const sectionOffenses = offenses.filter((o) => o.uri.endsWith('sections/section.liquid'));
      expect(sectionOffenses).toHaveLength(1);
      expect(sectionOffenses[0].message).toBe(
        "CSS class 'other-class' may be defined outside the scope of this file.",
      );
    });

    it('reports only out-of-scope theme classes, ignores unknown classes', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% stylesheet %}
              .a { color: red; }
              .c { color: blue; }
            {% endstylesheet %}
            <div class="a b c external">Hello</div>
          `,
          'snippets/other.liquid': `
            {% stylesheet %}
              .b { font-size: 14px; }
            {% endstylesheet %}
          `,
        },
        [ValidScopedCSSClass],
        noDeps,
      );

      const sectionOffenses = offenses.filter((o) => o.uri.endsWith('sections/section.liquid'));
      expect(sectionOffenses).toHaveLength(1);
      expect(sectionOffenses[0].message).toBe(
        "CSS class 'b' may be defined outside the scope of this file.",
      );
    });

    it('handles multiple stylesheet tags', async () => {
      const sourceCode = `
        {% stylesheet %}
          .from-first { color: red; }
        {% endstylesheet %}
        {% stylesheet %}
          .from-second { color: blue; }
        {% endstylesheet %}
        <div class="from-first from-second">Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        noDeps,
      );
      expect(offenses).toHaveLength(0);
    });

    it('does not report when a class is in scope even if also defined out of scope', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% stylesheet %}
              .shared-class { color: red; }
            {% endstylesheet %}
            <div class="shared-class">Hello</div>
          `,
          'snippets/unrelated.liquid': `
            {% stylesheet %}
              .shared-class { color: blue; }
            {% endstylesheet %}
          `,
        },
        [ValidScopedCSSClass],
        noDeps,
      );

      const sectionOffenses = offenses.filter((o) => o.uri.endsWith('sections/section.liquid'));
      expect(sectionOffenses).toHaveLength(0);
    });
  });

  describe('dynamic class attributes', () => {
    it('skips dynamic Liquid output in class attribute values', async () => {
      const sourceCode = `
        {% stylesheet %}
          .static { color: red; }
        {% endstylesheet %}
        <div class="static {{ dynamic_var }}">Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        noDeps,
      );
      expect(offenses).toHaveLength(0);
    });

    it('checks static parts and skips dynamic parts in mixed attributes', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% stylesheet %}
              .static { color: red; }
            {% endstylesheet %}
            <div class="static out-of-scope {{ dynamic }}">Hello</div>
          `,
          'snippets/other.liquid': `
            {% stylesheet %}
              .out-of-scope { color: blue; }
            {% endstylesheet %}
          `,
        },
        [ValidScopedCSSClass],
        noDeps,
      );

      const sectionOffenses = offenses.filter((o) => o.uri.endsWith('sections/section.liquid'));
      expect(sectionOffenses).toHaveLength(1);
      expect(sectionOffenses[0].message).toBe(
        "CSS class 'out-of-scope' may be defined outside the scope of this file.",
      );
    });

    it('does not report partial tokens glued to Liquid nodes', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% stylesheet %}
              .static { color: red; }
            {% endstylesheet %}
            <div class="btn-{{ size }} static">Hello</div>
          `,
          'snippets/other.liquid': `
            {% stylesheet %}
              .btn- { color: blue; }
            {% endstylesheet %}
          `,
        },
        [ValidScopedCSSClass],
        noDeps,
      );

      const sectionOffenses = offenses.filter((o) => o.uri.endsWith('sections/section.liquid'));
      expect(sectionOffenses).toHaveLength(0);
    });
  });

  describe('CSS class extraction edge cases', () => {
    it('extracts classes from complex selectors', async () => {
      const sourceCode = `
        {% stylesheet %}
          .parent > .child { color: red; }
          .a + .b ~ .c { color: blue; }
        {% endstylesheet %}
        <div class="parent child a b c">Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        noDeps,
      );
      expect(offenses).toHaveLength(0);
    });

    it('extracts classes from pseudo-class selectors', async () => {
      const sourceCode = `
        {% stylesheet %}
          .btn:hover { color: red; }
          .link::before { content: ''; }
        {% endstylesheet %}
        <div class="btn link">Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        noDeps,
      );
      expect(offenses).toHaveLength(0);
    });

    it('extracts classes from media queries', async () => {
      const sourceCode = `
        {% stylesheet %}
          @media (min-width: 768px) {
            .responsive { display: block; }
          }
        {% endstylesheet %}
        <div class="responsive">Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        noDeps,
      );
      expect(offenses).toHaveLength(0);
    });

    it('does not extract classes from CSS comments', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% stylesheet %}
              /* .commented-out { color: red; } */
              .real { color: blue; }
            {% endstylesheet %}
            <div class="commented-out real">Hello</div>
          `,
          'snippets/other.liquid': `
            {% stylesheet %}
              .commented-out { color: green; }
            {% endstylesheet %}
          `,
        },
        [ValidScopedCSSClass],
        noDeps,
      );

      const sectionOffenses = offenses.filter((o) => o.uri.endsWith('sections/section.liquid'));
      expect(sectionOffenses).toHaveLength(1);
      expect(sectionOffenses[0].message).toBe(
        "CSS class 'commented-out' may be defined outside the scope of this file.",
      );
    });
  });

  describe('HTML element types', () => {
    it('checks void elements', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% stylesheet %}
              .valid { color: red; }
            {% endstylesheet %}
            <input class="invalid">
          `,
          'snippets/other.liquid': `
            {% stylesheet %}
              .invalid { color: blue; }
            {% endstylesheet %}
          `,
        },
        [ValidScopedCSSClass],
        noDeps,
      );

      const sectionOffenses = offenses.filter((o) => o.uri.endsWith('sections/section.liquid'));
      expect(sectionOffenses).toHaveLength(1);
      expect(sectionOffenses[0].message).toBe(
        "CSS class 'invalid' may be defined outside the scope of this file.",
      );
    });

    it('checks self-closing elements', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% stylesheet %}
              .valid { color: red; }
            {% endstylesheet %}
            <img class="invalid" />
          `,
          'snippets/other.liquid': `
            {% stylesheet %}
              .invalid { color: blue; }
            {% endstylesheet %}
          `,
        },
        [ValidScopedCSSClass],
        noDeps,
      );

      const sectionOffenses = offenses.filter((o) => o.uri.endsWith('sections/section.liquid'));
      expect(sectionOffenses).toHaveLength(1);
      expect(sectionOffenses[0].message).toBe(
        "CSS class 'invalid' may be defined outside the scope of this file.",
      );
    });

    it('checks SVG elements and their children', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% stylesheet %}
              .valid { color: red; }
            {% endstylesheet %}
            <svg class="out-of-scope">
              <rect class="out-of-scope" />
              <g class="out-of-scope"></g>
            </svg>
          `,
          'snippets/other.liquid': `
            {% stylesheet %}
              .out-of-scope { color: blue; }
            {% endstylesheet %}
          `,
        },
        [ValidScopedCSSClass],
        noDeps,
      );

      const sectionOffenses = offenses.filter((o) => o.uri.endsWith('sections/section.liquid'));
      expect(sectionOffenses).toHaveLength(3);
      expect(sectionOffenses.every((o) => o.message.includes('out-of-scope'))).toBe(true);
    });
  });

  describe('empty and whitespace class attributes', () => {
    it('does not report for empty class attribute', async () => {
      const sourceCode = `
        {% stylesheet %}
          .a { color: red; }
        {% endstylesheet %}
        <div class="">Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        noDeps,
      );
      expect(offenses).toHaveLength(0);
    });
  });

  describe('ancestor stylesheet scope', () => {
    it('considers classes from an ancestor file as in scope', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% stylesheet %}
              .parent-class { color: red; }
            {% endstylesheet %}
            {% render 'child' %}
          `,
          'snippets/child.liquid': `
            <div class="parent-class">Hello</div>
          `,
        },
        [ValidScopedCSSClass],
        {
          getReferences: async (uri: string) => {
            if (uri.endsWith('snippets/child.liquid')) {
              return [
                {
                  source: { uri: 'file:///sections/section.liquid' },
                  target: { uri: 'file:///snippets/child.liquid' },
                  type: 'direct' as const,
                },
              ];
            }
            return [];
          },
          getDependencies: async (uri: string) => {
            if (uri.endsWith('sections/section.liquid')) {
              return [
                {
                  source: { uri: 'file:///sections/section.liquid' },
                  target: { uri: 'file:///snippets/child.liquid' },
                  type: 'direct' as const,
                },
              ];
            }
            return [];
          },
        },
      );

      const snippetOffenses = offenses.filter((o) => o.uri.endsWith('snippets/child.liquid'));
      expect(snippetOffenses).toHaveLength(0);
    });

    it('follows grandparent ancestors via direct references', async () => {
      const offenses = await check(
        {
          'layout/theme.liquid': `
            {% stylesheet %}
              .layout-class { color: red; }
            {% endstylesheet %}
            {% sections 'main' %}
          `,
          'sections/section.liquid': `
            {% render 'snippet' %}
          `,
          'snippets/snippet.liquid': `
            <div class="layout-class">Hello</div>
          `,
        },
        [ValidScopedCSSClass],
        {
          getReferences: async (uri: string) => {
            if (uri.endsWith('snippets/snippet.liquid')) {
              return [
                {
                  source: { uri: 'file:///sections/section.liquid' },
                  target: { uri: 'file:///snippets/snippet.liquid' },
                  type: 'direct' as const,
                },
              ];
            }
            if (uri.endsWith('sections/section.liquid')) {
              return [
                {
                  source: { uri: 'file:///layout/theme.liquid' },
                  target: { uri: 'file:///sections/section.liquid' },
                  type: 'direct' as const,
                },
              ];
            }
            return [];
          },
          getDependencies: async (uri: string) => {
            if (uri.endsWith('layout/theme.liquid')) {
              return [
                {
                  source: { uri: 'file:///layout/theme.liquid' },
                  target: { uri: 'file:///sections/section.liquid' },
                  type: 'direct' as const,
                },
              ];
            }
            if (uri.endsWith('sections/section.liquid')) {
              return [
                {
                  source: { uri: 'file:///sections/section.liquid' },
                  target: { uri: 'file:///snippets/snippet.liquid' },
                  type: 'direct' as const,
                },
              ];
            }
            return [];
          },
        },
      );

      const snippetOffenses = offenses.filter((o) => o.uri.endsWith('snippets/snippet.liquid'));
      expect(snippetOffenses).toHaveLength(0);
    });

    it('does not consider indirect references as ancestors', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% stylesheet %}
              .parent-class { color: red; }
            {% endstylesheet %}
          `,
          'snippets/child.liquid': `
            {% stylesheet %}
              .local-class { color: blue; }
            {% endstylesheet %}
            <div class="local-class parent-class">Hello</div>
          `,
        },
        [ValidScopedCSSClass],
        {
          getReferences: async (uri: string) => {
            if (uri.endsWith('snippets/child.liquid')) {
              return [
                {
                  source: { uri: 'file:///sections/section.liquid' },
                  target: { uri: 'file:///snippets/child.liquid' },
                  type: 'indirect' as const,
                },
              ];
            }
            return [];
          },
          getDependencies: async () => [],
        },
      );

      const snippetOffenses = offenses.filter((o) => o.uri.endsWith('snippets/child.liquid'));
      expect(snippetOffenses).toHaveLength(1);
      expect(snippetOffenses[0].message).toBe(
        "CSS class 'parent-class' may be defined outside the scope of this file.",
      );
    });
  });

  describe('rendered snippet scope', () => {
    it('considers classes from a rendered snippet as in scope', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% render 'styles' %}
            <div class="snippet-class">Hello</div>
          `,
          'snippets/styles.liquid': `
            {% stylesheet %}
              .snippet-class { color: red; }
            {% endstylesheet %}
          `,
        },
        [ValidScopedCSSClass],
        {
          getReferences: async () => [],
          getDependencies: async (uri: string) => {
            if (uri.endsWith('sections/section.liquid')) {
              return [
                {
                  source: { uri: 'file:///sections/section.liquid' },
                  target: { uri: 'file:///snippets/styles.liquid' },
                  type: 'direct' as const,
                },
              ];
            }
            return [];
          },
        },
      );

      const sectionOffenses = offenses.filter((o) => o.uri.endsWith('sections/section.liquid'));
      expect(sectionOffenses).toHaveLength(0);
    });

    it('considers classes from snippet descendants (recursive)', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% render 'outer' %}
            <div class="deep-class">Hello</div>
          `,
          'snippets/outer.liquid': `
            {% render 'inner' %}
          `,
          'snippets/inner.liquid': `
            {% stylesheet %}
              .deep-class { color: red; }
            {% endstylesheet %}
          `,
        },
        [ValidScopedCSSClass],
        {
          getReferences: async () => [],
          getDependencies: async (uri: string) => {
            if (uri.endsWith('sections/section.liquid')) {
              return [
                {
                  source: { uri: 'file:///sections/section.liquid' },
                  target: { uri: 'file:///snippets/outer.liquid' },
                  type: 'direct' as const,
                },
              ];
            }
            if (uri.endsWith('snippets/outer.liquid')) {
              return [
                {
                  source: { uri: 'file:///snippets/outer.liquid' },
                  target: { uri: 'file:///snippets/inner.liquid' },
                  type: 'direct' as const,
                },
              ];
            }
            return [];
          },
        },
      );

      const sectionOffenses = offenses.filter((o) => o.uri.endsWith('sections/section.liquid'));
      expect(sectionOffenses).toHaveLength(0);
    });

    it('considers classes from snippets rendered by ancestors', async () => {
      const offenses = await check(
        {
          'sections/section.liquid': `
            {% render 'styles' %}
            {% render 'child' %}
          `,
          'snippets/styles.liquid': `
            {% stylesheet %}
              .style-class { color: red; }
            {% endstylesheet %}
          `,
          'snippets/child.liquid': `
            <div class="style-class">Hello</div>
          `,
        },
        [ValidScopedCSSClass],
        {
          getReferences: async (uri: string) => {
            if (uri.endsWith('snippets/child.liquid')) {
              return [
                {
                  source: { uri: 'file:///sections/section.liquid' },
                  target: { uri: 'file:///snippets/child.liquid' },
                  type: 'direct' as const,
                },
              ];
            }
            return [];
          },
          getDependencies: async (uri: string) => {
            if (uri.endsWith('sections/section.liquid')) {
              return [
                {
                  source: { uri: 'file:///sections/section.liquid' },
                  target: { uri: 'file:///snippets/styles.liquid' },
                  type: 'direct' as const,
                },
                {
                  source: { uri: 'file:///sections/section.liquid' },
                  target: { uri: 'file:///snippets/child.liquid' },
                  type: 'direct' as const,
                },
              ];
            }
            return [];
          },
        },
      );

      const childOffenses = offenses.filter((o) => o.uri.endsWith('snippets/child.liquid'));
      expect(childOffenses).toHaveLength(0);
    });
  });

  describe('CSS asset file scope', () => {
    it('considers classes from .css files in the assets folder', async () => {
      const offenses = await check(
        {
          'assets/theme.css': `.asset-class { color: red; }`,
          'sections/section.liquid': `
            <div class="asset-class">Hello</div>
          `,
        },
        [ValidScopedCSSClass],
        {
          getReferences: async () => [],
          getDependencies: async () => [],
        },
      );

      const sectionOffenses = offenses.filter((o) => o.uri.endsWith('sections/section.liquid'));
      expect(sectionOffenses).toHaveLength(0);
    });

    it('considers classes from multiple .css asset files', async () => {
      const offenses = await check(
        {
          'assets/base.css': `.base-class { color: red; }`,
          'assets/components.css': `.component-class { color: blue; }`,
          'sections/section.liquid': `
            <div class="base-class component-class">Hello</div>
          `,
        },
        [ValidScopedCSSClass],
        {
          getReferences: async () => [],
          getDependencies: async () => [],
        },
      );

      const sectionOffenses = offenses.filter((o) => o.uri.endsWith('sections/section.liquid'));
      expect(sectionOffenses).toHaveLength(0);
    });
  });

  describe('graceful degradation', () => {
    it('reports no offenses when getReferences is unavailable', async () => {
      const sourceCode = `
        <div class="undefined-class">Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        {},
      );
      expect(offenses).toHaveLength(0);
    });

    it('reports no offenses when getDependencies is unavailable', async () => {
      const sourceCode = `
        <div class="undefined-class">Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        { getReferences: async () => [] },
      );
      expect(offenses).toHaveLength(0);
    });
  });

  describe('no classes defined anywhere', () => {
    it('reports no offenses when no CSS classes are defined in scope', async () => {
      const sourceCode = `
        <div class="some-class">Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        noDeps,
      );
      expect(offenses).toHaveLength(0);
    });
  });

  describe('no class usage', () => {
    it('reports no offenses when there are no class attributes', async () => {
      const sourceCode = `
        {% stylesheet %}
          .some-class { color: red; }
        {% endstylesheet %}
        <div>Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        noDeps,
      );
      expect(offenses).toHaveLength(0);
    });
  });
});
