import { describe, it, expect } from 'vitest';
import { toLiquidHtmlAST } from '../ast';

describe('Unit: liquid-blocks', () => {
  describe('malformed block bodies terminate instead of looping forever', () => {
    // Regression: the real tolerant path is HTML-mode (`toLiquidHtmlAST` with
    // allowUnclosedDocumentNode), used by liquid-render-tree's parse-html-fragment.
    // There the orphan `{% endwhen %}` is consumed as a degraded node so the loop reaches
    // the real `{% endcase %}` terminator — rather than leaking up to parseAttributeList,
    // where the sibling close tag would hit the unguarded throw in parseLiquidTag.
    it('tolerant HTML mode (toLiquidHtmlAST + allowUnclosedDocumentNode) degrades without throwing', () => {
      expect(() =>
        toLiquidHtmlAST(`<li {% case x %}{% when 'a' %} data-a{% endwhen %}{% endcase %}>z</li>`, {
          allowUnclosedDocumentNode: true,
          mode: 'tolerant',
        }),
      ).not.to.throw();
    });

    it('tolerant HTML mode degrades a branchless block with an orphan end tag without throwing', () => {
      expect(() =>
        toLiquidHtmlAST(`<li {% capture y %}{% endwhen %}{% endcapture %}>z</li>`, {
          allowUnclosedDocumentNode: true,
          mode: 'tolerant',
        }),
      ).not.to.throw();
    });
  });
});
