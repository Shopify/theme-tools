/*
 * Adversarial error corpus for the tolerant-parser overhead benchmark.
 *
 * Every `source` here is *invalid* Liquid/HTML: the strict `toLiquidHtmlAST`
 * throws on each one, so these sources exist only to exercise the tolerant
 * path (`toTolerantLiquidHtmlAST`), which recovers instead of throwing and
 * surfaces one `LiquidErrorNode` per region it gives up on.
 *
 * The bench arm that consumes this corpus measures resync/recovery cost, not
 * throughput on clean input.
 *
 * Shape is identical to `THEME_FILES` in `theme-bundle.ts`
 * (`Array<{ path; source }>`) so the bench loop stays uniform across corpora.
 *
 * Contract (verified in C2): each `source` passed to
 * `toTolerantLiquidHtmlAST` returns a `DocumentNode` without throwing and
 * contains at least one `LiquidErrorNode`.
 */

/*
 * A single orphan close tag followed by a valid variable output. The close
 * has no matching open, so the tolerant parser emits one error node, then
 * resynchronizes on the next construct-open boundary and recovers the output.
 *
 * Repeating this unit forces the resync loop to fire once per unit — the
 * "error every few tokens" density stress.
 */
const FREQUENT_ERROR_UNIT = "{% endfor %}{{ x }}{% endif %}{{ y }}";

/*
 * A well-formed Liquid+HTML fragment the strict parser accepts as-is.
 *
 * Repeated many times it builds a large clean body; a single orphan close
 * tag appended near EOF then costs exactly one recovery, proving tail
 * recovery does not rescan the whole document.
 */
const CLEAN_UNIT =
  '<div class="card">{{ product.title }}' +
  "{% if product.available %}<span>{{ product.price }}</span>{% endif %}" +
  "</div>\n";

export const ERROR_FILES: Array<{ path: string; source: string }> = [
  {
    /* Seeded verbatim from tolerant.test.ts:150 — one orphan close tag. */
    path: "error-corpus/single-error.liquid",
    source: "{% endfor %}",
  },
  {
    /*
     * Seeded verbatim from tolerant.test.ts:178 — two orphan closes with a
     * valid output recovered between them (interleaved resync).
     */
    path: "error-corpus/interleaved-resync.liquid",
    source: "{% endfor %}{{ good }}{% endif %}",
  },
  {
    /*
     * Net-new: an orphan close roughly every few tokens across a moderately
     * long source, bounding worst-case resync frequency.
     *
     * 60 units yields 120 error nodes interleaved with 120 recovered
     * outputs.
     */
    path: "error-corpus/pathological-frequent.liquid",
    source: FREQUENT_ERROR_UNIT.repeat(60),
  },
  {
    /*
     * Net-new: a large valid body (150 clean units) with a single orphan
     * close tag just before EOF — "parse a lot, then recover once".
     */
    path: "error-corpus/large-clean-error-near-eof.liquid",
    source: CLEAN_UNIT.repeat(150) + "{% endfor %}",
  },
];
