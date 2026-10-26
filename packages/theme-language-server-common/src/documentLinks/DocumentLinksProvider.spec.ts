import { path } from '@shopify/theme-check-common';
import { MockFileSystem } from '@shopify/theme-check-common/src/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../documents';
import { ThemeGraphManager } from '../server/ThemeGraphManager';
import { mockConnection } from '../test/MockConnection';
import { DocumentLinksProvider } from './DocumentLinksProvider';

describe('DocumentLinksProvider', () => {
  let documentManager: DocumentManager;
  let documentLinksProvider: DocumentLinksProvider;
  let rootUri: string;
  let uriString: string;

  beforeEach(() => {
    rootUri = path.normalize('file:///path/to/project');
    documentManager = new DocumentManager();
    documentLinksProvider = new DocumentLinksProvider(documentManager, async () => []);
  });

  it('should return an empty array for non-LiquidHtml documents', async () => {
    uriString = path.join(rootUri, 'templates/index.json');
    documentManager.open(uriString, '{"sections": {}}', 1);

    const result = await documentLinksProvider.documentLinks(uriString);
    expect(result).toEqual([]);
  });

  it('should return an empty array for non-existent documents', async () => {
    uriString = path.join(rootUri, 'sections/non-existent.liquid');

    const result = await documentLinksProvider.documentLinks(uriString);
    expect(result).toEqual([]);
  });

  it('should create links for graph dependencies in a LiquidHtml document', async () => {
    const liquidHtmlContent = `
      {% render 'snippet1' %}
      {% include 'snippet2' %}
      {% section 'header' %}
      {% echo 'echo.js' | asset_url %}
      {% assign x = 'assign.css' | asset_url %}
      {{ 'asset.js' | asset_url }}
      {% content_for 'block', type: 'block_name' %}
      {% block 'container' %}{% endblock %}
      {% block '_private' %}{% endblock %}
      {% block 'with_args', block.settings.alignment: 'center' %}{% endblock %}
      <product-gallery></product-gallery>
    `;
    const theme = createTheme(liquidHtmlContent, rootUri, {
      'snippets/snippet1.liquid': '',
      'snippets/snippet2.liquid': '',
      'sections/header.liquid': '',
      'assets/echo.js': '',
      'assets/assign.css': '',
      'assets/asset.js': '',
      'assets/product-gallery.js':
        "customElements.define('product-gallery', class extends HTMLElement {});",
      'blocks/block_name.liquid': '',
      'blocks/container.liquid': '',
      'blocks/_private.liquid': '',
      'blocks/with_args.liquid': '',
    });
    uriString = theme.uri;
    documentManager = theme.documentManager;
    documentLinksProvider = theme.documentLinksProvider;

    const result = await documentLinksProvider.documentLinks(uriString);

    expect(result.map(({ target }) => target)).toEqual([
      path.join(rootUri, 'snippets/snippet1.liquid'),
      path.join(rootUri, 'snippets/snippet2.liquid'),
      path.join(rootUri, 'sections/header.liquid'),
      path.join(rootUri, 'assets/echo.js'),
      path.join(rootUri, 'assets/assign.css'),
      path.join(rootUri, 'assets/asset.js'),
      path.join(rootUri, 'blocks/block_name.liquid'),
      path.join(rootUri, 'blocks/container.liquid'),
      path.join(rootUri, 'blocks/_private.liquid'),
      path.join(rootUri, 'blocks/with_args.liquid'),
      path.join(rootUri, 'assets/product-gallery.js'),
    ]);
  });

  it('should link schema block types and custom elements to their definitions', async () => {
    const liquidHtmlContent = `{% schema %}
      {"blocks":[{"type":"feature"}],"presets":[{"name":"Feature","blocks":[{"type":"feature"}]}]}
    {% endschema %}
    <product-gallery></product-gallery>`;
    const theme = createTheme(liquidHtmlContent, rootUri, {
      'blocks/feature.liquid': '',
      'assets/product-gallery.js':
        "customElements.define('product-gallery', class extends HTMLElement {});",
    });
    uriString = theme.uri;
    documentManager = theme.documentManager;
    documentLinksProvider = theme.documentLinksProvider;

    const result = await documentLinksProvider.documentLinks(uriString);

    const featureUri = path.join(rootUri, 'blocks/feature.liquid');
    const featureLinks = result.filter(({ target }) => target === featureUri);
    const textDocument = TextDocument.create(uriString, 'liquid', 1, liquidHtmlContent);
    const expectedFeatureRanges = [...liquidHtmlContent.matchAll(/"type":"feature"/g)]
      .map(([value], index, matches) => {
        const start = matches[index].index!;
        return Range.create(
          textDocument.positionAt(start),
          textDocument.positionAt(start + value.length),
        );
      })
      .sort((a, b) => a.start.line - b.start.line || a.start.character - b.start.character);
    const actualFeatureRanges = featureLinks
      .map(({ range }) => range)
      .sort((a, b) => a.start.line - b.start.line || a.start.character - b.start.character);
    const galleryLink = result.find(
      ({ target }) => target === path.join(rootUri, 'assets/product-gallery.js'),
    );
    const galleryStart = liquidHtmlContent.indexOf('<product-gallery');

    expect(featureLinks).toHaveLength(2);
    expect(actualFeatureRanges).toEqual(expectedFeatureRanges);
    expect(galleryLink?.range).toEqual(
      Range.create(
        textDocument.positionAt(galleryStart),
        textDocument.positionAt(galleryStart + '<product-gallery'.length),
      ),
    );
  });

  it('should not create multiple links for the special @theme block type', async () => {
    const liquidHtmlContent = `{% schema %}{"blocks":[{"type":"@theme"}]}{% endschema %}`;
    const theme = createTheme(liquidHtmlContent, rootUri, {
      'blocks/feature.liquid': '',
    });

    const result = await theme.documentLinksProvider.documentLinks(theme.uri);

    expect(result).toEqual([]);
  });

  it.each([
    "{% block 'shopify://apps/example_app/blocks/example-block/00000000-0000-4000-8000-000000000000' %}{% endblock %}",
    "{% liquid\n block 'shopify://apps/example_app/blocks/example-block/00000000-0000-4000-8000-000000000000'\n endblock\n %}",
  ])('should skip app block links while preserving theme block links: %s', async (appBlock) => {
    const theme = createTheme(`${appBlock}{% block 'container' %}{% endblock %}`, rootUri, {
      'blocks/container.liquid': '',
    });

    const result = await theme.documentLinksProvider.documentLinks(theme.uri);
    expect(result.map((link) => link.target)).toEqual([
      path.join(rootUri, 'blocks/container.liquid'),
    ]);
  });

  it('should not create a link for the {% partial %} tag', async () => {
    const theme = createTheme(`{% partial 'x' %}{% endpartial %}`, rootUri, {});
    const result = await theme.documentLinksProvider.documentLinks(theme.uri);
    expect(result).toEqual([]);
  });
});

function createTheme(source: string, rootUri: string, files: Record<string, string>) {
  const uri = path.join(rootUri, 'sections/main.liquid');
  const fs = new MockFileSystem({ ...files, 'sections/main.liquid': source }, rootUri);
  const connection = mockConnection(rootUri);
  const getModeForURI = async () => 'theme' as const;
  const documentManager = new DocumentManager(
    fs,
    connection,
    undefined,
    getModeForURI,
    async () => true,
  );
  const themeGraphManager = new ThemeGraphManager(
    connection,
    documentManager,
    fs,
    async () => rootUri,
    getModeForURI,
  );
  const documentLinksProvider = new DocumentLinksProvider(documentManager, (uri) =>
    themeGraphManager.getDependencies(uri, undefined, { includeIndirect: false }),
  );

  documentManager.open(uri, source, 1);

  return { uri, documentManager, documentLinksProvider };
}
