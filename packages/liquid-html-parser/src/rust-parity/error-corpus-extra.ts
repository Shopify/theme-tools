/*
 * Stray `endsection` inputs for the parity corpus, part 3b.
 *
 * Since #1309, `section` is a standalone tag, so an `endsection` with no open
 * block throws. No other corpus input reaches that error path.
 *
 * These live here, not in fixtures/error-corpus.ts, because that file feeds
 * existing tests. Same shape as `ERROR_FILES`. Error-corpus sources get no
 * prefix cuts.
 */
export const ERROR_FILES_EXTRA: Array<{ path: string; source: string }> = [
  {
    path: 'error-corpus-extra/stray-endsection.liquid',
    source: '{% endsection %}',
  },
  {
    path: 'error-corpus-extra/endsection-inside-if.liquid',
    source: '{% if a %}{% endsection %}{% endif %}',
  },
  {
    path: 'error-corpus-extra/section-then-endsection.liquid',
    source: "{% section 'header' %}{% endsection %}",
  },
];
