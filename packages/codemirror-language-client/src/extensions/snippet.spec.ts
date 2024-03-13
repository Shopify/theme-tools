import { describe, expect, it } from 'vitest';
import { translateSnippet } from './snippet';

describe('Module: snippets', () => {
  describe('Unit: translateSnippet', () => {
    it('translate $0 to $99', () => {
      expect(translateSnippet('$0')).to.equal('${99}');
    });

    it('handles $1, $2, $3 propertly', () => {
      expect(translateSnippet('def $1, $2, $3, $0 end')).to.equal(
        'def ${1}, ${2}, ${3}, ${99} end',
      );
    });

    it('handles placeholders properly', () => {
      expect(translateSnippet('def ${1:hi}, ${2:hi}, $0 end')).to.equal(
        'def ${1:hi}, ${2:hi}, ${99} end',
      );
    });

    it('appends $99 at the end of the string if $0 is not present', () => {
      expect(translateSnippet('def $1 end')).to.equal('def ${1} end${99}');
    });

    // CodeMirror doesn't support VS Code's ${2:$1} syntax, so we gotta do something about it.
    it('applies a fallback strategy when placeholders refer to other placeholders', () => {
      expect(translateSnippet('${1:hi} ${2:oh$1no}')).to.equal('${1:hi} ${2:ohno}${99}');
    });
  });
});
