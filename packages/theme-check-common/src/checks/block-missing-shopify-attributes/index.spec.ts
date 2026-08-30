import { expect, describe, it } from 'vitest';
import { BlockMissingShopifyAttributes } from './index';
import { check, MockTheme } from '../../test';

describe('Module: BlockMissingShopifyAttributes', () => {
  it('reports an offense when the block schema sets `tag: null` and the markup omits `block.shopify_attributes`', async () => {
    const theme: MockTheme = {
      'blocks/text.liquid': `
        <h2>{{ block.settings.heading }}</h2>
        {% schema %}
        {
          "name": "Text",
          "tag": null,
          "settings": []
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [BlockMissingShopifyAttributes]);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).to.match(/must render `\{\{ block\.shopify_attributes \}\}`/);
    expect(offenses[0].check).to.eql('BlockMissingShopifyAttributes');
  });

  it('does not report when `block.shopify_attributes` is rendered on the wrapper', async () => {
    const theme: MockTheme = {
      'blocks/text.liquid': `
        <div {{ block.shopify_attributes }}>
          <h2>{{ block.settings.heading }}</h2>
        </div>
        {% schema %}
        {
          "name": "Text",
          "tag": null,
          "settings": []
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [BlockMissingShopifyAttributes]);
    expect(offenses).to.be.empty;
  });

  it('does not report when `tag` is omitted (Shopify wraps the block automatically)', async () => {
    const theme: MockTheme = {
      'blocks/text.liquid': `
        <h2>{{ block.settings.heading }}</h2>
        {% schema %}
        {
          "name": "Text",
          "settings": []
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [BlockMissingShopifyAttributes]);
    expect(offenses).to.be.empty;
  });

  it('does not report when `tag` is a non-null string (Shopify wraps the block in that element)', async () => {
    const theme: MockTheme = {
      'blocks/text.liquid': `
        <h2>{{ block.settings.heading }}</h2>
        {% schema %}
        {
          "name": "Text",
          "tag": "section",
          "settings": []
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [BlockMissingShopifyAttributes]);
    expect(offenses).to.be.empty;
  });

  it('accepts bracket access (`block["shopify_attributes"]`) as valid', async () => {
    const theme: MockTheme = {
      'blocks/text.liquid': `
        <div {{ block["shopify_attributes"] }}>content</div>
        {% schema %}
        {
          "name": "Text",
          "tag": null
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [BlockMissingShopifyAttributes]);
    expect(offenses).to.be.empty;
  });

  it('does not run on section files', async () => {
    // Even if a section has `tag: null` declared (which is permitted on
    // sections too), the requirement to render block.shopify_attributes is
    // a block-specific concern, so this check should ignore sections.
    const theme: MockTheme = {
      'sections/missing.liquid': `
        <div></div>
        {% schema %}
        {
          "name": "Section",
          "tag": null,
          "settings": []
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [BlockMissingShopifyAttributes]);
    expect(offenses).to.be.empty;
  });

  it('does not run on snippet files', async () => {
    // Snippets do not have schemas, so the check has nothing to act on.
    // This is a guard against future changes that might trip on the path.
    const theme: MockTheme = {
      'snippets/helper.liquid': `
        <div>{{ thing }}</div>
      `,
    };

    const offenses = await check(theme, [BlockMissingShopifyAttributes]);
    expect(offenses).to.be.empty;
  });

  it('reports the offense at the schema `tag` field position', async () => {
    const source = `
        <h2>{{ block.settings.heading }}</h2>
        {% schema %}
        {
          "name": "Text",
          "tag": null
        }
        {% endschema %}
      `;
    const theme: MockTheme = {
      'blocks/text.liquid': source,
    };

    const offenses = await check(theme, [BlockMissingShopifyAttributes]);
    expect(offenses).toHaveLength(1);

    // The reported range should be inside the schema body, anchored on the
    // `tag` field's value (a sanity check that we're using the JSON AST
    // node positions correctly).
    const offendingRange = source.slice(offenses[0].start.index, offenses[0].end.index);
    expect(offendingRange).to.match(/null/);
  });
});
