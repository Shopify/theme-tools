import { FilterEntry, ObjectEntry } from '@shopify/theme-check-common';
import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';

const filters: FilterEntry[] = [
  {
    name: 'upcase',
    syntax: 'string | upcase',
    return_type: [{ type: 'string', name: '' }],
  },
  {
    name: 'downcase',
    syntax: 'string | downcase',
    return_type: [{ type: 'string', name: '' }],
  },
  {
    name: 'split',
    syntax: 'string | split: string',
    return_type: [{ type: 'array', array_value: 'string' }],
  },
  {
    name: 'first',
    syntax: 'array | first',
    return_type: [{ type: 'untyped', name: '' }],
  },
  {
    name: 'map',
    syntax: 'array | map: string',
    return_type: [{ type: 'array', array_value: 'string' }],
  },
  {
    name: 'where',
    syntax: 'array | where: string, string',
    return_type: [{ type: 'array', array_value: 'string' }],
  },
  {
    name: 'metafield_tag',
    syntax: 'metafield | metafield_tag',
    return_type: [{ type: 'string', name: '' }],
  },
  {
    name: 'default',
    syntax: 'variable | default: variable',
    return_type: [{ type: 'untyped', name: '' }],
    parameters: [
      {
        description: 'Whether to use false values instead of the default.',
        name: 'allow_false',
        positional: true,
        required: false,
        types: ['boolean'],
      },
    ],
  },
  {
    syntax: 'string | highlight: string',
    name: 'highlight',
    parameters: [
      {
        description: 'The string that you want to highlight.',
        name: 'highlighted_term',
        positional: true,
        required: true,
        types: ['string'],
      },
    ],
  },
  {
    syntax: 'string | preload_tag: as: string',
    name: 'preload_tag',
    parameters: [
      {
        description: 'The type of element or resource to preload.',
        name: 'as',
        positional: false,
        required: true,
        types: ['string'],
      },
    ],
  },
  {
    name: 'missing_syntax',
    /* syntax: undefined */
  },
];

const objects: ObjectEntry[] = [
  {
    name: 'string',
    return_type: [{ type: 'string', name: '' }],
  },
  {
    name: 'number',
    return_type: [{ type: 'number', name: '' }],
  },
  {
    name: 'array',
    return_type: [{ type: 'array', array_value: 'string' }],
  },
  {
    name: 'metafield',
    return_type: [],
  },
  {
    name: 'product',
    return_type: [],
  },
];

const anyFilters = filtersNamesOfInputType('variable').concat(
  filters.filter((entry) => !entry.syntax).map((x) => x.name),
);
const stringFilters = filtersNamesOfInputType('string');
const metafieldFilters = filtersNamesOfInputType('metafield');
const arrayFilters = filtersNamesOfInputType('array');
const allFilters = filters.map((x) => x.name).sort();

describe('Module: FilterCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider({
      documentManager: new DocumentManager(),
      themeDocset: {
        filters: async () => filters,
        objects: async () => objects,
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
    });
  });
  //

  it('completes with all the filters when no specific filters exist for that type', async () => {
    await expect(provider).to.complete('{{ product | █ }}', allFilters);
  });

  it('completes with all the filters when the type is unknown', async () => {
    await expect(provider).to.complete('{{ undefined | █ }}', allFilters);
  });

  it('should complete string types with string filters', async () => {
    await expect(provider).to.complete('{{ string | █ }}', stringFilters.concat(anyFilters));
  });

  it('should complete array types with array filters', async () => {
    await expect(provider).to.complete('{{ array | █ }}', arrayFilters.concat(anyFilters));
  });

  it('should complete named types with named-type filters', async () => {
    await expect(provider).to.complete('{{ metafield | █ }}', metafieldFilters.concat(anyFilters));
  });

  it('should infer type in filter chains', async () => {
    await expect(provider).to.complete(
      '{{ metafield | metafield_tag | █ }}',
      stringFilters.concat(anyFilters),
    );
    await expect(provider).to.complete(
      '{{ string | split: "" | █ }}',
      arrayFilters.concat(anyFilters),
    );
    await expect(provider).to.complete('{{ array | first | █ }}', allFilters);
  });

  it('should append the any filters after the filters of the specific type', async () => {
    // As in, the anyFilters are at the _end_ and not shown at the top.
    await expect(provider).to.complete('{{ string | █ }}', stringFilters.concat(anyFilters));
  });

  describe('when there are no required parameters', () => {
    it('should not include parameters in the insertText of the completion', async () => {
      await expect(provider).to.complete('{{ string | defa█ }}', [
        expect.objectContaining({
          label: 'default',
          insertText: 'default',
          insertTextFormat: 1,
        }),
      ]);
    });
  });

  describe('when there are required positional parameters', () => {
    it('should include parameters in the insertText of the completion', async () => {
      await expect(provider).to.complete('{{ string | h█ }}', [
        expect.objectContaining({
          label: 'highlight',
          insertText: "highlight: '${1:highlighted_term}'",
          insertTextFormat: 2,
        }),
      ]);
    });
  });

  describe('when there are required named parameters', () => {
    it('should include parameters in the insertText of the completion', async () => {
      await expect(provider).to.complete('{{ string | pre█ }}', [
        expect.objectContaining({
          label: 'preload_tag',
          insertText: "preload_tag: as: '$1'",
          insertTextFormat: 2,
        }),
      ]);
    });
  });
});

function filtersNamesOfInputType(inputType: string): string[] {
  return filters
    .filter((x) => x.syntax?.startsWith(inputType))
    .map((x) => x.name)
    .sort();
}
