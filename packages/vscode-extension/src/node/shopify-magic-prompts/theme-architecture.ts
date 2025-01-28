export function themeArchitectureRules(): string {
  const folderStructure = Object.keys(THEME_ARCHITECTURE)
    .map((key) => `    ${key}: theme_${key}()`)
    .join(',\n');

  const themeEntries = Object.entries(THEME_ARCHITECTURE)
    .map(([key, value]) => {
      return [`  theme_${key} = {`, `    ${value.summary.replace(/\n/g, '\n    ')}`, '  }'].join(
        '\n',
      );
    })
    .join('\n');

  return [
    '<theme_architecture>',
    '  folder_structure = {',
    folderStructure,
    '  }',
    '',
    themeEntries,
    '',
    '  ∀ file ∈ theme:',
    '    validate(file.location) ∈ folder_structure;',
    '</theme_architecture>',
  ].join('\n');
}

export const THEME_ARCHITECTURE: { [key: string]: { summary: string; tip?: string } } = {
  //
  // Sections ------------------------------------------------------------------
  sections: {
    summary: bulletPoints([
      'Liquid files that define customizable sections of a page',
      'They include blocks and settings defined via a schema, allowing merchants to modify them in the theme editor',
    ]),

    tip: bulletPoints([
      'As sections grow in complexity, consider extracting reusable parts into snippets for better maintainability',
      'Also look for opportunities to make components more flexible by moving hardcoded values into section settings that merchants can customize',
    ]),
  },
  //
  // Blocks --------------------------------------------------------------------
  blocks: {
    summary: bulletPoints([
      'Configurable elements within sections that can be added, removed, or reordered',
      'They are defined with a schema tag for merchant customization in the theme editor',
    ]),
    tip: bulletPoints([
      'Break blocks into smaller, focused components that each do one thing well',
      'Look for opportunities to extract repeated patterns into separate block types',
      "Make blocks more flexible by moving hardcoded values into schema settings, but keep each block's schema simple and focused on its specific purpose",
    ]),
  },
  //
  // Layout --------------------------------------------------------------------
  layout: {
    summary: bulletPoints([
      'Defines the structure for repeated content such as headers and footers, wrapping other template files',
      "It's the frame that holds the page together, but it's not the content",
    ]),
    tip: bulletPoints([
      'Keep layouts focused on structural elements',
      'Look for opportunities to extract components into sections',
      'Headers, footers, navigation menus, and other reusable elements should be sections to enable merchant customization through the theme editor',
    ]),
  },
  //
  // Snippets ------------------------------------------------------------------
  snippets: {
    summary: bulletPoints([
      'Reusable code fragments included in templates, sections, and layouts via the render tag',
      'Ideal for logic that needs to be reused but not directly edited in the theme editor',
    ]),
    tip:
      bulletPoints([
        'We must have a {% doc %} in snippets',
        'Keep snippets focused on a single responsibility',
        'Use variables to make snippets more reusable',
        'Add a header comment block that documents expected inputs, dependencies, and any required objects/variables that need to be passed to the snippet',
      ]) + snippetHeader(),
  },
  //
  // Config --------------------------------------------------------------------
  config: {
    summary: bulletPoints([
      'Holds settings data and schema for theme customization options like typography and colors, accessible through the Admin theme editor.',
    ]),
  },
  //
  // Assets --------------------------------------------------------------------
  assets: {
    summary: bulletPoints([
      'Contains static files such as CSS, JavaScript, and images. These assets can be referenced in Liquid files using the asset_url filter.',
    ]),
  },
  //
  // Locales -------------------------------------------------------------------
  locales: {
    summary: bulletPoints([
      'Stores translation files for localizing theme editor and storefront content.',
    ]),
  },
  //
  // Templates -----------------------------------------------------------------
  templates: {
    summary: bulletPoints([
      'JSON files that specify which sections appear on each page type (e.g., product, collection, blog).',
      'They are wrapped by layout files for consistent header/footer content.',
      'Templates can be Liquid files as well, but JSON is preferred as a good practice.',
    ]),
  },
  //
  // Customers -----------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'templates/customers': {
    summary: bulletPoints([
      'Templates for customer-related pages such as login and account overview.',
    ]),
  },
  //
  // Metaobjects ---------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'templates/metaobject': {
    summary: bulletPoints(['Templates for rendering custom content types defined as metaobjects.']),
  },
};

function bulletPoints(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join('\n');
}

function snippetHeader(): string {
  return `
<example>
  {% comment %}
    Renders loading-spinner.

    @param {string} foo - some foo
    @param {string} [bar] - optional bar

    @example
    {% render 'loading-spinner', foo: 'foo' %}
    {% render 'loading-spinner', foo: 'foo', bar: 'bar' %}
  {% endcomment %}
</example>`;
}
