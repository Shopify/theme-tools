import { FilterEntry, TagEntry } from '@shopify/theme-check-common';
import { ThemeLiquidDocsManager } from '@shopify/theme-check-docs-updater';

export async function liquidRules() {
  return [
    '<liquid_rules>',
    '',
    await filters(),
    await tags(),
    await objects(),
    validationRules(),
    '',
    '</liquid_rules>',
  ].join('\n');
}

async function filters() {
  const filters = await liquidDocs().filters();
  const filtersString = getCategories(filters)
    .map((c) => formatFilter(filters, c))
    .join('\n');

  return `  valid_filters = [${filtersString}\n  ]`;
}

async function tags() {
  const tags = await liquidDocs().tags();
  const tagsString = getCategories(tags)
    .map((c) => formatTag(tags, c))
    .join('\n');

  return `  valid_tags = [${tagsString}\n  ]`;
}

async function objects() {
  const objects = await liquidDocs().objects();
  const objectsString = objects
    .filter((o) => o.access?.global === true)
    .map((o) => o.name)
    .join('",\n      "');

  return `  valid_objects = [
      "${objectsString}"\n  ]`;
}

function formatFilter(filters: FilterEntry[], category: string) {
  return `
    // ${category}
    ${filters
      .filter((f) => f.category === category)
      .map((f) => `{ name: "${f.name}", usage: "${f.syntax}" }`)
      .join(',\n    ')},`;
}

function formatTag(tags: TagEntry[], category: string) {
  return `
    // ${category}
    ${tags
      .filter((t) => t.category === category)
      .map((t) => `"${t.name}"`)
      .join(', ')},`;
}

function getCategories(items: { category?: string }[]): string[] {
  return [
    ...new Set(items.map((item) => item.category).filter((c): c is string => c !== undefined)),
  ];
}

function liquidDocs() {
  return new ThemeLiquidDocsManager();
}

function validationRules() {
  return `
  validation_rules = {
    syntax: {
      - Use {% liquid %} for multiline code
      - Use {% # comments %} for inline comments
      - Never invent new filters, tags, or objects
      - Follow proper tag closing order
      - Use proper object dot notation
      - Respect object scope and availability
    },

    theme_structure: {
      - Place files in appropriate directories
      - Follow naming conventions
      - Respect template hierarchy
      - Maintain proper section/block structure
      - Use appropriate schema settings
    }
  }

  ∀ liquid_code ∈ theme:
    validate_syntax(liquid_code) ∧
    validate_filters(liquid_code.filters ∈ valid_filters) ∧
    validate_tags(liquid_code.tags ∈ valid_tags) ∧
    validate_objects(liquid_code.objects ∈ valid_objects) ∧
    validate_structure(liquid_code.location ∈ theme_structure)`;
}
