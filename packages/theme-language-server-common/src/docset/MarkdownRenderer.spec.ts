import { describe, it, expect } from 'vitest';

import { render, renderHtmlEntry, type HtmlEntry } from './MarkdownRenderer';
import type { DocsetEntry } from '@shopify/theme-check-common';

const DOC_ENTRY: DocsetEntry = {
  name: 'entry',
  summary: 'summary',
  description: 'description',
  deprecated: false,
};

const HTML_ENTRY: HtmlEntry = {
  name: 'entry',
  description: 'description',
};

describe('MarkdownRenderer', () => {
  describe('render()', () => {
    it('converts a docset entry to markdown', async () => {
      expect(render(DOC_ENTRY)).toEqual(`### entry\nsummary\n\n---\n\ndescription`);
    });

    describe('when the entry has syntax', () => {
      it('includes the syntax in the markdown', async () => {
        expect(render({ ...DOC_ENTRY, syntax: 'string | image_tag' })).toEqual(
          `### entry\n\`\`\`liquid\n{{ string | image_tag }}\n\`\`\`\n\n---\n\nsummary\n\n---\n\ndescription`,
        );
      });

      describe('and the syntax already includes liquid tags', () => {
        it('does not wrap the syntax in curly braces', async () => {
          expect(render({ ...DOC_ENTRY, syntax: '{% form %}' })).toEqual(
            `### entry\n\`\`\`liquid\n{% form %}\n\`\`\`\n\n---\n\nsummary\n\n---\n\ndescription`,
          );
        });
      });
    });

    describe('when the description contains a blockquote (e.g. a Caution/Note warning)', () => {
      it('preserves the blockquote on its own line instead of collapsing it onto the previous line', () => {
        const entry: DocsetEntry = {
          name: 'image_url',
          description:
            'Use it on image objects.\n\n&gt; Caution:\n&gt; You must specify either a width or height parameter.',
          deprecated: false,
        };

        expect(render(entry)).toEqual(
          '### image_url\nUse it on image objects.\n\n> Caution:\n> You must specify either a width or height parameter.',
        );
      });
    });
  });

  describe('renderHtmlEntry()', () => {
    it('converts a docset entry to markdown', async () => {
      expect(renderHtmlEntry(HTML_ENTRY)).toEqual(`### entry\ndescription`);
    });
  });
});
