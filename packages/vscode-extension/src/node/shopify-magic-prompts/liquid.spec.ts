import { describe, it, expect, vi } from 'vitest';
import { liquidRules } from './liquid';

vi.mock('@shopify/theme-check-docs-updater', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ThemeLiquidDocsManager: vi.fn().mockImplementation(() => ({
    filters: () =>
      Promise.resolve([
        { name: 'append', syntax: 'append: string', category: 'String' },
        { name: 'capitalize', syntax: 'capitalize', category: 'String' },
        { name: 'abs', syntax: 'abs', category: 'Math' },
      ]),
    tags: () =>
      Promise.resolve([
        { name: 'if', category: 'Control Flow' },
        { name: 'unless', category: 'Control Flow' },
        { name: 'form', category: 'Forms' },
      ]),
    objects: () =>
      Promise.resolve([
        { name: 'product', access: { global: true } },
        { name: 'collection', access: { global: true } },
        { name: 'name', access: { global: false } },
      ]),
  })),
}));

describe('liquid', () => {
  describe('liquidRules()', () => {
    it('returns formatted liquid rules string', async () => {
      const result = await liquidRules();
      expect(result).toBe(
        [
          '<liquid_rules>',
          '',
          '  valid_filters = [',
          '    // String',
          '    { name: "append", usage: "append: string" },',
          '    { name: "capitalize", usage: "capitalize" },',
          '',
          '    // Math',
          '    { name: "abs", usage: "abs" },',
          '  ]',
          '  valid_tags = [',
          '    // Control Flow',
          '    "if", "unless",',
          '',
          '    // Forms',
          '    "form",',
          '  ]',
          '  valid_objects = [',
          '      "product",',
          '      "collection"',
          '  ]',
          '',
          '  validation_rules = {',
          '    syntax: {',
          '      - Use {% liquid %} for multiline code',
          '      - Use {% # comments %} for inline comments',
          '      - Never invent new filters, tags, or objects',
          '      - Follow proper tag closing order',
          '      - Use proper object dot notation',
          '      - Respect object scope and availability',
          '    },',
          '',
          '    theme_structure: {',
          '      - Place files in appropriate directories',
          '      - Follow naming conventions',
          '      - Respect template hierarchy',
          '      - Maintain proper section/block structure',
          '      - Use appropriate schema settings',
          '    }',
          '  }',
          '',
          '  ∀ liquid_code ∈ theme:',
          '    validate_syntax(liquid_code) ∧',
          '    validate_filters(liquid_code.filters ∈ valid_filters) ∧',
          '    validate_tags(liquid_code.tags ∈ valid_tags) ∧',
          '    validate_objects(liquid_code.objects ∈ valid_objects) ∧',
          '    validate_structure(liquid_code.location ∈ theme_structure)',
          '',
          '</liquid_rules>',
        ].join('\n'),
      );
    });
  });
});
