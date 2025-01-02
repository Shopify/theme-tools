import { describe, expect, it } from 'vitest';
import { NoImportmap } from '.';
import { check as reportOffenses } from '../../test';

describe('Module: NoImportmap', () => {
  it('should report offense when using <script type="importmap">', async () => {
    const file = `<script type="importmap">
    {
      "imports": {
        "a.js": "https://foo.bar/baz.js"
      }
    }
    </script>`;
    const startIndex = file.indexOf('<script');
    const endIndex = file.indexOf('</script>') + '</script>'.length;

    const offenses = await reportOffenses({ 'code.liquid': file }, [NoImportmap]);

    expect(offenses).to.have.length(1);
    const { message, start, end } = offenses[0];

    expect(message).toEqual(
      'Until browsers permit multiple importmap entries, only themes can have an importmap',
    );
    expect(start.index).toEqual(startIndex);
    expect(end.index).toEqual(endIndex);

    expect(offenses[0].suggest).to.have.length(1);
    expect(offenses[0]!.suggest![0].message).to.equal("Remove the 'importmap' script tag");
  });
});
