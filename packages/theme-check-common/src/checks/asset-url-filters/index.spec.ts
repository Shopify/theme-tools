import { describe, it, expect } from 'vitest';
import { runLiquidCheck, highlightedOffenses } from '../../test';
import { AssetUrlFilters } from './index';

describe('Module: AssetUrlFilters', () => {
  it('should report an offense when asset_url or img_url filters are not used', async () => {
    const sourceCode = `
      <img src="{{ 'image.png' }}" />
      <link href="{{ 'style.css' }}" />
      <script src="{{ 'script.js' }}" defer="defer"></script>
      {{ url | img_tag }}
      {{ "https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" | stylesheet_tag }}
      `;

    const offenses = await runLiquidCheck(AssetUrlFilters, sourceCode);
    expect(offenses).to.have.length(5);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql([
      'src="{{ \'image.png\' }}"',
      'href="{{ \'style.css\' }}"',
      'src="{{ \'script.js\' }}"',
      'url | img_tag',
      '"https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" | stylesheet_tag',
    ]);
  });

  it('should not report an offense when asset_url or img_url filters are used', async () => {
    const sourceCode = `
      <img src="{{ 'image.png' | asset_url }}" />
      <link href="{{ 'style.css' | img_url }}" />
      <script src="{{ 'script.js' | img_url }}" defer="defer"></script>
      {{ url | img_tag | asset_url }},
      {{ 'bootstrap.min.css' | asset_url | stylesheet_tag }}
      {{ product | image_url: width: 450 | img_tag }}
    `;

    const offenses = await runLiquidCheck(AssetUrlFilters, sourceCode);
    expect(offenses).to.be.empty;
    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.be.empty;
  });

  it('should not report an offense for links, videos, iframes', async () => {
    const sourceCode = `
      <iframe
        id="inlineFrameExample"
        title="Inline Frame Example"
        width="300"
        height="200"
        src="https://www.openstreetmap.org/export/embed.html?bbox=-0.004017949104309083%2C51.47612752641776%2C0.00030577182769775396%2C51.478569861898606&layer=mapnik"
      >
      </iframe>
      <a href="https://google.com"></a>
      <embed type="video/webm" src="https://google.com/..." width="250" height="200">
    `;

    const offenses = await runLiquidCheck(AssetUrlFilters, sourceCode);
    expect(offenses).to.be.empty;
  });

  it('should not report an offense when asset_url or img_url filters are used with other filters', async () => {
    const sourceCode = `
      <img src="{{ 'image.png' | asset_url | img_url }}" />
      <link href="{{ 'style.css' | img_url | asset_url }}" />
      <script src="{{ 'script.js' | img_url | asset_url}}" defer="defer"></script>
    `;

    const offenses = await runLiquidCheck(AssetUrlFilters, sourceCode);
    expect(offenses).to.be.empty;
    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.be.empty;
  });

  it('should not report an offense for non-asset elements', async () => {
    const sourceCode = `
      <div class="{{ 'my-class' }}"></div>
      <a href="{{ 'page.html' }}">Link</a>
    `;

    const offenses = await runLiquidCheck(AssetUrlFilters, sourceCode);
    expect(offenses).to.be.empty;
    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.be.empty;
  });

  it('should not report an offense when asset_url filters are used with deprecated assets', async () => {
    const sourceCode = `
    {{ product.featured_image | product_img_url }}
    {{ article.image | article_img_url }}
    {{ collection.image | collection_img_url }}
    {{ 'image.png' | img_url }}
    `;

    const offenses = await runLiquidCheck(AssetUrlFilters, sourceCode);
    expect(offenses).to.be.empty;
    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.be.empty;
  });

  it('should not report an offense when asset_url filters are used with non deprecated assets', async () => {
    const sourceCode = `
    {{ 'option_selection.js' | shopify_asset_url }}
    {{ 'lightbox.js' | global_asset_url | script_tag }}
    {{ 'disclaimer.pdf' | file_url }}
    {{ 'potions-header.png' | file_img_url: 'large' }}
    {{ 'cart.js' | asset_url }}
    {{ 'red-and-black-bramble-berries.jpg' | asset_img_url }}
    `;

    const offenses = await runLiquidCheck(AssetUrlFilters, sourceCode);
    expect(offenses).to.be.empty;
    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.be.empty;
  });

  it('should report the correct message and index for a single offense', async () => {
    const sourceCode = `<img src="{{ 'image.png' }}" />`;

    const offenses = await runLiquidCheck(AssetUrlFilters, sourceCode);
    expect(offenses).to.have.length(1);

    const offense = offenses[0];
    expect(offense.message).to.equal(
      'Use one of the asset_url filters to serve assets for better performance',
    );
    expect(offense.start.index).to.equal(5);
    expect(offense.end.index).to.equal(28);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql(['src="{{ \'image.png\' }}"']);
  });

  it('should not report an offense when asset_url filters are used with known assets', async () => {
    const sourceCode = `<link rel="canonical" href="{{ canonical_url }}">
    <link href={{ canonical_url }}
    {{ 'example.js' | canonical_url }}`;

    const offenses = await runLiquidCheck(AssetUrlFilters, sourceCode);
    expect(offenses).to.be.empty;
    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.be.empty;
  });
});
