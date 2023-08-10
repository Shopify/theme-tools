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

const anyFilters = filtersNamesOfInputType('variable');
const stringFilters = filtersNamesOfInputType('string');
const metafieldFilters = filtersNamesOfInputType('metafield');
const arrayFilters = filtersNamesOfInputType('array');
const allFilters = filters.map((x) => x.name);

describe('Module: FilterCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider(new DocumentManager(), {
      filters: async () => filters,
      objects: async () => objects,
      tags: async () => [],
    });
  });

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
    await expect(provider).to.complete('{{ array | first | █ }}', stringFilters.concat(anyFilters));
    await expect(provider).to.complete(
      '{{ string | split: "" | █ }}',
      arrayFilters.concat(anyFilters),
    );
  });

  it('should append the any filters after the filters of the specific type', async () => {
    // As in, the anyFilters are at the _end_ and not shown at the top.
    await expect(provider).to.complete('{{ string | █ }}', stringFilters.concat(anyFilters));
  });
});

function filtersNamesOfInputType(inputType: string): string[] {
  return filters
    .filter((x) => x.syntax?.startsWith(inputType))
    .map((x) => x.name)
    .sort();
}
