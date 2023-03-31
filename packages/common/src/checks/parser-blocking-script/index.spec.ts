import { expect } from 'chai';
import { ParserBlockingScript } from '.';
import { check as reportOffenses } from '../../test-helper';

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
  });
});
