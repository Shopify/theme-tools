---
'@shopify/theme-check-common': minor
'@shopify/theme-check-browser': minor
'@shopify/theme-check-node': minor
---

Add support for fixes and suggestions

**New**: `context.report` now accepts two new properties:

-  `fix: Fixer`, accepts a callback that is given a corrector and produces transformations that are deemed **safe to apply without confirmation** on the initial document.

   - JSON checks will receive a [`JSONCorrector` (API)](packages/common/src/fixes/correctors/json-corrector.ts)
   - LiquidHTML checks will receive a [`StringCorrector` (API)](packages/common/src/fixes/correctors/string-corrector)

   ```typescript
   type Fixer<S> = (corrector: Corrector<S>) => void
   ```

- `suggest: Suggestion[]`, accepts an array of Suggestion. Those are like fixes but are not considered safe either because there's multiple ways to fix the problem or because the change requires care.

   ```typescript
   type Suggestion<S> = {
     message: String;
     fix: Fixer<S>;
   }
   ```

Example usage:
```typescript
// A safe change, add a "TODO" translation key
context.report({
  message: `The translation for '${path}' is missing`,
  startIndex: closest.loc!.start.offset,
  endIndex: closest.loc!.end.offset,
  fix(corrector) {
    // corrector is inferred to be a JSONCorrector
    corrector.add(path, 'TODO');
  },
});

// An unsafe change, add `defer` or `async` attributes on the script tag
context.report({
  message: 'Avoid parser blocking scripts by adding `defer` or `async` on this tag',
  startIndex: node.position.start,
  endIndex: node.position.end,
  suggest: [{
    message: 'Add defer attribute',
    fix: corrector => {
      // corrector is inferred to be a StringCorrector
      corrector.insert(node.blockStartPosition.end, ' defer')
    },
  }, {
    message: 'Add async attribute',
    fix: corrector => {
      // corrector is inferred to be a StringCorrector
      corrector.insert(node.blockStartPosition.end, ' async')
    };
  }],
})
```

Under the hood, corrector calls will be converted into a list of `Fix` objects.

One can implement a `FixApplicator` (a async function that takes a `SourceCode` and `Fix` objects) to apply fixes in different contexts.

- In Node.js, we'll implement a `FixApplicator` that applies the fixes to the initial file and then save the changes to disk.
- In the Language Server, we'll implement `FixApplicator`s that turn the `Fix`es into `TextEdit` objects.

**New**: the top level API now offers the `autofix` function, one that takes a `FixApplicator` as argument.

This `autofix` function applies all the *safe* changes (and ignores suggestions).
