import { expect, describe, it } from 'vitest';
import { ParserBlockingScript } from '.';
import { applySuggestions, check as reportOffenses } from '../../test';

describe('Module: ParserBlockingScript', () => {
  it('should report the correct offense for the Liquid filter', async () => {
    const file = "{{ 'asset' | script_tag }}";
    const startIndex = file.indexOf('script_tag');
    const endIndex = startIndex + 'script_tag'.length;

    const offenses = await reportOffenses(
      {
        'code.liquid': file,
      },
      [ParserBlockingScript],
    );

    expect(offenses).to.have.length(1);
    const { check, message, start, end } = offenses[0];
    expect(check).to.equal(ParserBlockingScript.meta.code);
    expect(message).to.contain('Use a <script> tag with async');
    expect(start.index).to.equal(startIndex);
    expect(end.index).to.equal(endIndex);
  });

  it('should report the correct offense when using the script tag', async () => {
    const file = `
        <script src="https://foo.bar/baz.js"></script>
      `;
    const startIndex = file.indexOf('<script');
    const endIndex = file.indexOf('</script>') + '</script>'.length;

    const offenses = await reportOffenses(
      {
        'code.liquid': file,
      },
      [ParserBlockingScript],
    );

    expect(offenses).to.have.length(1);
    const { check, message, start, end } = offenses[0];
    expect(check).to.equal(ParserBlockingScript.meta.code);
    expect(message).to.contain('Avoid parser blocking scripts by adding `defer`');
    expect(start.index).to.equal(startIndex);
    expect(end.index).to.equal(endIndex);
  });

  describe('Case: LiquidFilter corrections', () => {
    it('should suggest to replace a LiquidVariableOutput with a script tag that has the expression as URL', async () => {
      const file = "{{ 'asset' | script_tag }}";
      const offenses = await reportOffenses(
        {
          'code.liquid': file,
        },
        [ParserBlockingScript],
      );

      expect(offenses).to.have.length(1);
      const offense = offenses[0]!;
      expect(offense).to.suggest(file, `Use an HTML script tag with the defer attribute instead`, {
        startIndex: 0,
        endIndex: file.length,
        insert: `<script src="{{ 'asset' }}" defer></script>`,
      });
      expect(offense).to.suggest(file, `Use an HTML script tag with the async attribute instead`, {
        startIndex: 0,
        endIndex: file.length,
        insert: `<script src="{{ 'asset' }}" async></script>`,
      });

      const suggestions = applySuggestions(file, offense);
      expect(suggestions).to.include(`<script src="{{ 'asset' }}" defer></script>`);
      expect(suggestions).to.include(`<script src="{{ 'asset' }}" async></script>`);
    });

    it('should suggest to replace a LiquidVariableOutput with a script tag that has the expression and previous filters as URL', async () => {
      const file = "{{ 'asset' | asset_url | script_tag }}";
      const offenses = await reportOffenses(
        {
          'code.liquid': file,
        },
        [ParserBlockingScript],
      );

      expect(offenses).to.have.length(1);
      const offense = offenses[0];
      expect(offense).to.suggest(file, `Use an HTML script tag with the defer attribute instead`, {
        startIndex: 0,
        endIndex: file.length,
        insert: `<script src="{{ 'asset' | asset_url }}" defer></script>`,
      });
      expect(offense).to.suggest(file, `Use an HTML script tag with the async attribute instead`, {
        startIndex: 0,
        endIndex: file.length,
        insert: `<script src="{{ 'asset' | asset_url }}" async></script>`,
      });

      const suggestions = applySuggestions(file, offense);
      expect(suggestions).to.include(`<script src="{{ 'asset' | asset_url }}" defer></script>`);
      expect(suggestions).to.include(`<script src="{{ 'asset' | asset_url }}" async></script>`);
    });

    it('should not suggest anything if the script_tag appears in an echo tag', async () => {
      const file = "{% echo 'asset' | asset_url | script_tag %}";
      const offenses = await reportOffenses(
        {
          'code.liquid': file,
        },
        [ParserBlockingScript],
      );

      expect(offenses).to.have.length(1);
      const { suggest } = offenses[0];
      expect(suggest).not.to.exist;
    });

    it('should not suggest anything if the script_tag appears in an assign tag', async () => {
      const file = "{% assign script = 'asset' | asset_url | script_tag %}";
      const offenses = await reportOffenses(
        {
          'code.liquid': file,
        },
        [ParserBlockingScript],
      );

      expect(offenses).to.have.length(1);
      const { suggest } = offenses[0];
      expect(suggest).not.to.exist;
    });

    it('should not suggest anything if the script_tag appears in a liquid tag', async () => {
      const file = "{% liquid\necho 'asset' | asset_url | script_tag %}";
      const offenses = await reportOffenses(
        {
          'code.liquid': file,
        },
        [ParserBlockingScript],
      );

      expect(offenses).to.have.length(1);
      const { suggest } = offenses[0];
      expect(suggest).not.to.exist;
    });
  });

  describe('Case: script tag suggestion', () => {
    it('should suggest adding both attributes at the end', async () => {
      const file = `<script src="a.js"></script>`;
      const offenses = await reportOffenses({ 'code.liquid': file }, [ParserBlockingScript]);

      expect(offenses).to.have.length(1);

      const offense = offenses[0];
      expect(offense).to.suggest(file, `Use an HTML script tag with the defer attribute instead`, {
        startIndex: file.indexOf('>'),
        endIndex: file.indexOf('>'),
        insert: ` defer`,
      });
      expect(offense).to.suggest(file, `Use an HTML script tag with the async attribute instead`, {
        startIndex: file.indexOf('>'),
        endIndex: file.indexOf('>'),
        insert: ` async`,
      });

      const suggestions = applySuggestions(file, offense);
      expect(suggestions).to.include('<script src="a.js" defer></script>');
      expect(suggestions).to.include('<script src="a.js" async></script>');
    });
  });

  describe('No offenses', () => {
    it('should not report any offense when async is set on a script tag', async () => {
      const file = `
        <script src="https://foo.bar/baz.js" async></script>
      `;
      const offenses = await reportOffenses(
        {
          'code.liquid': file,
        },
        [ParserBlockingScript],
      );
      expect(offenses).to.have.length(0);
    });

    it('should not report any offense when defer is set on a script tag', async () => {
      const file = `
        <script src="https://foo.bar/baz.js" defer="defer"></script>
      `;
      const offenses = await reportOffenses(
        {
          'code.liquid': file,
        },
        [ParserBlockingScript],
      );
      expect(offenses).to.have.length(0);
    });

    it('should not report any offense when async and defer are set on a script tag', async () => {
      const file = `
        <script src="https://foo.bar/baz.js" async defer></script>
      `;
      const offenses = await reportOffenses(
        {
          'code.liquid': file,
        },
        [ParserBlockingScript],
      );
      expect(offenses).to.have.length(0);
    });

    it('should not report any offense when using scripts of type module', async () => {
      const file = `
        <script src="https://foo.bar/baz.js" type="module"></script>
        <script src="https://foo.bar/baz.js" type="importmap"></script>
      `;
      const offenses = await reportOffenses(
        {
          'code.liquid': file,
        },
        [ParserBlockingScript],
      );
      expect(offenses).to.have.length(0);
    });
  });
});
