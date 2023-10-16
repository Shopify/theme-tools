import { expect, describe, it } from 'vitest';
import { highlightedOffenses, applySuggestions, runLiquidCheck, applyFix } from '../../test';
import { DeprecatedFilter } from './index';
import { Offense } from '../../types';

describe('Module: DeprecatedFilter', () => {
  it('should report an offense when a deprecated filter is used', async () => {
    const sourceCode = `
      {{ '#EA5AB9' | hex_to_rgba }}
      {{ '#EA5AB9' | hex_to_rgba: 0.5 }}
    `;

    const offenses = await runLiquidCheck(DeprecatedFilter, sourceCode);
    expect(offenses.map((e) => e.message)).toEqual([
      "Deprecated filter 'hex_to_rgba', consider using 'color_to_rgb'.",
      "Deprecated filter 'hex_to_rgba', consider using 'color_to_rgb'.",
    ]);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual(['| hex_to_rgba', '| hex_to_rgba: 0.5']);
  });

  it('should not report an offense when a non-deprecated filter is used', async () => {
    const sourceCode = `
      {{ '#EA5AB9' | color_to_rgb }}
      {{ '#EA5AB9' | color_to_rgb | color_modify: 'alpha', 0.5 }}
    `;

    const offenses = await runLiquidCheck(DeprecatedFilter, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it("should suggest a fix to replace the deprecated 'hex_to_rgba' filter", async () => {
    const sourceCode = '{{ "#EA5AB9" | hex_to_rgba }}';

    const offenses = await runLiquidCheck(DeprecatedFilter, sourceCode);
    const fixedCode = applyFix(sourceCode, offenses[0]);

    expect(fixedCode).toEqual('{{ "#EA5AB9" | color_to_rgb }}');
  });

  it("should suggest a fix to replace the deprecated 'hex_to_rgba' filter when an alpha value is passed", async () => {
    const sourceCode = '{{ "#EA5AB9" | hex_to_rgba: 0.5 }}';

    const offenses = await runLiquidCheck(DeprecatedFilter, sourceCode);
    const fixedCode = applyFix(sourceCode, offenses[0]);

    expect(fixedCode).toEqual(`{{ "#EA5AB9" | color_to_rgb | color_modify: 'alpha', 0.5 }}`);
  });

  it("should suggest a fix to replace the deprecated 'img_url' filter", async () => {
    const sourceCode = `
      {{ product.featured_image | img_url: '200x', scale: 2, crop: 'center' }}
      {{ product.featured_image | img_url: '200x', scale: 2 }}
      {{ product.featured_image | img_url: '200x' }}
      {{ product.featured_image | img_url: '200x300' }}
      {{ product.featured_image | img_url: 'x300' }}
      {{ product.featured_image | img_url }}
      {{ product.featured_image
        | img_url: '200x'
      }}
      {{ product.featured_image
        | img_url: '200x',
          format: format
        | image_tag
      }}
      {{product.featured_image | img_url: '200x'}}
      {{-product.featured_image | img_url: '200x'-}}
      {% assign url = product.featured_image | img_url: '200x' %}
      {% assign url =
        product.featured_image | img_url: '200x'
      %}
      {{ product.featured_image | img_url: 'master' }}
      {{ product.featured_image | img_url: '4000x', scale: 2 }}

      // not supported:
      {{ product.featured_image | img_url: variable }}
      {{ product.featured_image | img_url: '200x', scale: variable }}
    `;

    const offenses = await runLiquidCheck(DeprecatedFilter, sourceCode);
    const fixedCode = fixSourceCode(sourceCode, offenses);

    const expected = `
      {{ product.featured_image | image_url: width: 400, crop: 'center' }}
      {{ product.featured_image | image_url: width: 400 }}
      {{ product.featured_image | image_url: width: 200 }}
      {{ product.featured_image | image_url: width: 200, height: 300 }}
      {{ product.featured_image | image_url: height: 300 }}
      {{ product.featured_image | image_url: width: 100, height: 100 }}
      {{ product.featured_image
        | image_url: width: 200
      }}
      {{ product.featured_image
        | image_url: width: 200, format: format
        | image_tag
      }}
      {{product.featured_image | image_url: width: 200}}
      {{-product.featured_image | image_url: width: 200-}}
      {% assign url = product.featured_image | image_url: width: 200 %}
      {% assign url =
        product.featured_image | image_url: width: 200
      %}
      {{ product.featured_image | image_url: width: 100 }}
      {{ product.featured_image | image_url: width: 5760 }}

      // not supported:
      {{ product.featured_image | img_url: variable }}
      {{ product.featured_image | img_url: '200x', scale: variable }}
    `;

    expect(fixedCode).toEqual(expected);
  });

  it("should suggest a fix to replace the deprecated 'img_url' filter with named sizes", async () => {
    const sourceCode = `
      {{ product.featured_image | img_url: 'pico', scale: 2, crop: 'center' }}
      {{ product.featured_image | img_url: 'pico' }}

      {{ product.featured_image | img_url: 'icon', scale: 2, crop: 'center' }}
      {{ product.featured_image | img_url: 'icon' }}

      {{ product.featured_image | img_url: 'thumb', scale: 2, crop: 'center' }}
      {{ product.featured_image | img_url: 'thumb' }}

      {{ product.featured_image | img_url: 'small', scale: 2, crop: 'center' }}
      {{ product.featured_image | img_url: 'small' }}

      {{ product.featured_image | img_url: 'compact', scale: 2, crop: 'center' }}
      {{ product.featured_image | img_url: 'compact' }}

      {{ product.featured_image | img_url: 'medium', scale: 2, crop: 'center' }}
      {{ product.featured_image | img_url: 'medium' }}

      {{ product.featured_image | img_url: 'large', scale: 2, crop: 'center' }}
      {{ product.featured_image | img_url: 'large' }}

      {{ product.featured_image | img_url: 'grande', scale: 2, crop: 'center' }}
      {{ product.featured_image | img_url: 'grande' }}

      {{ product.featured_image | img_url: 'original', scale: 2, crop: 'center' }}
      {{ product.featured_image | img_url: 'original' }}

      {{ product.featured_image | img_url: 'master', scale: 2, crop: 'center' }}
      {{ product.featured_image | img_url: 'master' }}
    `;

    const offenses = await runLiquidCheck(DeprecatedFilter, sourceCode);
    const fixedCode = fixSourceCode(sourceCode, offenses);

    const expected = `
      {{ product.featured_image | image_url: width: 32, height: 32, crop: 'center' }}
      {{ product.featured_image | image_url: width: 16, height: 16 }}

      {{ product.featured_image | image_url: width: 64, height: 64, crop: 'center' }}
      {{ product.featured_image | image_url: width: 32, height: 32 }}

      {{ product.featured_image | image_url: width: 100, height: 100, crop: 'center' }}
      {{ product.featured_image | image_url: width: 50, height: 50 }}

      {{ product.featured_image | image_url: width: 200, height: 200, crop: 'center' }}
      {{ product.featured_image | image_url: width: 100, height: 100 }}

      {{ product.featured_image | image_url: width: 320, height: 320, crop: 'center' }}
      {{ product.featured_image | image_url: width: 160, height: 160 }}

      {{ product.featured_image | image_url: width: 480, height: 480, crop: 'center' }}
      {{ product.featured_image | image_url: width: 240, height: 240 }}

      {{ product.featured_image | image_url: width: 960, height: 960, crop: 'center' }}
      {{ product.featured_image | image_url: width: 480, height: 480 }}

      {{ product.featured_image | image_url: width: 1200, height: 1200, crop: 'center' }}
      {{ product.featured_image | image_url: width: 600, height: 600 }}

      {{ product.featured_image | image_url: width: 2048, height: 2048, crop: 'center' }}
      {{ product.featured_image | image_url: width: 1024, height: 1024 }}

      {{ product.featured_image | image_url: width: 100, crop: 'center' }}
      {{ product.featured_image | image_url: width: 100 }}
    `;

    expect(fixedCode).toEqual(expected);
  });

  it("should suggest a fix to replace the deprecated 'article_img_url' filter", async () => {
    const sourceCode = '{{ article.image | article_img_url }}';

    const offenses = await runLiquidCheck(DeprecatedFilter, sourceCode);
    const suggestions = applySuggestions(sourceCode, offenses[0]);

    expect(suggestions).toEqual(['{{ article.image | image_url: width: 100, height: 100 }}']);
  });

  it("should suggest a fix to replace the deprecated 'article_img_url' filter with named sizes", async () => {
    const sourceCode = '{{ article.image | article_img_url: "grande" }}';

    const offenses = await runLiquidCheck(DeprecatedFilter, sourceCode);
    const suggestions = applySuggestions(sourceCode, offenses[0]);

    expect(suggestions).toEqual(['{{ article.image | image_url: width: 600, height: 600 }}']);
  });

  it("should suggest a fix to replace the deprecated 'collection_img_url' filter", async () => {
    const sourceCode = '{{ collection.image | collection_img_url }}';

    const offenses = await runLiquidCheck(DeprecatedFilter, sourceCode);
    const suggestions = applySuggestions(sourceCode, offenses[0]);

    expect(suggestions).toEqual(['{{ collection.image | image_url: width: 100, height: 100 }}']);
  });

  it("should suggest a fix to replace the deprecated 'collection_img_url' filter with named sizes", async () => {
    const sourceCode = '{{ collection.image | collection_img_url: "grande" }}';

    const offenses = await runLiquidCheck(DeprecatedFilter, sourceCode);
    const suggestions = applySuggestions(sourceCode, offenses[0]);

    expect(suggestions).toEqual(['{{ collection.image | image_url: width: 600, height: 600 }}']);
  });

  it("should suggest a fix to replace the deprecated 'product_img_url' filter", async () => {
    const sourceCode = '{{ p.featured_image | product_img_url }}';

    const offenses = await runLiquidCheck(DeprecatedFilter, sourceCode);
    const suggestions = applySuggestions(sourceCode, offenses[0]);

    expect(suggestions).toEqual(['{{ p.featured_image | image_url: width: 100, height: 100 }}']);
  });

  it("should suggest a fix to replace the deprecated 'product_img_url' filter with named sizes", async () => {
    const sourceCode = '{{ p.featured_image | product_img_url: "grande" }}';

    const offenses = await runLiquidCheck(DeprecatedFilter, sourceCode);
    const suggestions = applySuggestions(sourceCode, offenses[0]);

    expect(suggestions).toEqual(['{{ p.featured_image | image_url: width: 600, height: 600 }}']);
  });

  it("should suggest a fix to replace the deprecated 'img_tag' filter", async () => {
    const sourceCode = `
      {{ product | img_tag }}
      {{ product | img_tag: 'image alt text' }}
      {{ product | img_tag: 'image alt text', 'my-css-class' }}
      {{ product | img_tag: 'image alt text', 'my-css-class', '200x300' }}
      {{ product | img_tag: 'image alt text', 'my-css-class', 'grande' }}
    `;

    const offenses = await runLiquidCheck(DeprecatedFilter, sourceCode);
    const fixedCode = fixSourceCode(sourceCode, offenses);

    const expected = `
      {{ product | image_url: width: 100 | image_tag }}
      {{ product | image_url: width: 100 | image_tag: alt: 'image alt text' }}
      {{ product | image_url: width: 100 | image_tag: alt: 'image alt text', class: 'my-css-class' }}
      {{ product | image_url: width: 200, height: 300 | image_tag: width: 200, height: 300, alt: 'image alt text', class: 'my-css-class' }}
      {{ product | image_url: width: 600, height: 600 | image_tag: width: 600, height: 600, alt: 'image alt text', class: 'my-css-class' }}
    `;

    expect(fixedCode).toEqual(expected);
  });
});

function fixSourceCode(source: string, offenses: Offense[]) {
  offenses
    .reverse()
    .filter((offense) => offense.suggest)
    .forEach((offense) => {
      source = applySuggestions(source, offense)?.join('') || source;
    });

  return source;
}
