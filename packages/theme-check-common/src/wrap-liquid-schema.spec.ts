import { describe, expect, it } from 'vitest';
import { check } from './test';
import {
  LiquidCheckDefinition,
  LiquidSchemaNode,
  Severity,
  SourceCodeType,
} from './types';

function makeSchemaCapturingCheck(captured: LiquidSchemaNode[]): LiquidCheckDefinition {
  return {
    meta: {
      code: 'SchemaSpyCheck',
      name: 'Schema Spy',
      docs: {
        description: 'Test check that captures every LiquidSchema invocation.',
        recommended: true,
        url: 'https://example.com',
      },
      type: SourceCodeType.LiquidHtml,
      severity: Severity.ERROR,
      schema: {},
      targets: [],
    },
    create() {
      return {
        async LiquidSchema(node) {
          captured.push(node);
        },
      };
    },
  };
}

describe('Module: wrapLiquidSchema', () => {
  it('fires LiquidSchema once per valid {% schema %} tag in a section', async () => {
    const captured: LiquidSchemaNode[] = [];
    await check(
      {
        'sections/hero.liquid': `
          <div></div>
          {% schema %}
          {
            "name": "Hero",
            "settings": []
          }
          {% endschema %}
        `,
      },
      [makeSchemaCapturingCheck(captured)],
    );

    expect(captured).toHaveLength(1);
    expect(captured[0].validSchema).not.toBeInstanceOf(Error);
    expect(captured[0].ast).not.toBeInstanceOf(Error);
    expect(captured[0].schema.type).toBe('section');
    expect(captured[0].schema.name).toBe('hero');
    expect(captured[0].validSchema.name).toBe('Hero');
    expect(captured[0].offset).toBe(captured[0].node.blockStartPosition.end);
  });

  it('fires LiquidSchema for theme blocks', async () => {
    const captured: LiquidSchemaNode[] = [];
    await check(
      {
        'blocks/card.liquid': `
          <div></div>
          {% schema %}
          {
            "name": "Card"
          }
          {% endschema %}
        `,
      },
      [makeSchemaCapturingCheck(captured)],
    );

    expect(captured).toHaveLength(1);
    expect(captured[0].schema.type).toBe('block');
    expect(captured[0].schema.name).toBe('card');
  });

  it('does not fire LiquidSchema in snippet files', async () => {
    const captured: LiquidSchemaNode[] = [];
    await check(
      {
        'snippets/utils.liquid': `
          {% schema %}
          { "name": "Oops" }
          {% endschema %}
        `,
      },
      [makeSchemaCapturingCheck(captured)],
    );

    expect(captured).toHaveLength(0);
  });

  it('does not fire LiquidSchema for non-schema raw tags', async () => {
    const captured: LiquidSchemaNode[] = [];
    await check(
      {
        'sections/hero.liquid': `
          {% stylesheet %}
            .hero { color: red; }
          {% endstylesheet %}
        `,
      },
      [makeSchemaCapturingCheck(captured)],
    );

    expect(captured).toHaveLength(0);
  });

  it('composes with an existing LiquidRawTag method', async () => {
    const rawTagNames: string[] = [];
    const schemaHits: LiquidSchemaNode[] = [];

    const composedCheck: LiquidCheckDefinition = {
      meta: {
        code: 'ComposedSpyCheck',
        name: 'Composed Spy',
        docs: {
          description: 'Test check that uses both LiquidRawTag and LiquidSchema.',
          recommended: true,
          url: 'https://example.com',
        },
        type: SourceCodeType.LiquidHtml,
        severity: Severity.ERROR,
        schema: {},
        targets: [],
      },
      create() {
        return {
          async LiquidRawTag(node) {
            rawTagNames.push(node.name);
          },
          async LiquidSchema(node) {
            schemaHits.push(node);
          },
        };
      },
    };

    await check(
      {
        'sections/hero.liquid': `
          {% stylesheet %}.x{}{% endstylesheet %}
          {% schema %}
          { "name": "Hero" }
          {% endschema %}
        `,
      },
      [composedCheck],
    );

    // Both raw tags visited; only the schema tag fired LiquidSchema
    expect(rawTagNames).toEqual(expect.arrayContaining(['stylesheet', 'schema']));
    expect(schemaHits).toHaveLength(1);
    expect(schemaHits[0].schema.name).toBe('hero');
  });
});
