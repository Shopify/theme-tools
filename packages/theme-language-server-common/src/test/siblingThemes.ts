import { MockTheme } from '@shopify/theme-check-common/src/test';

/**
 * Two themes in one workspace. The name of `shop-preview` starts with the name
 * of `shop`, so a plain URI prefix match on `themes/shop` also finds the files
 * of `themes/shop-preview`.
 */
export const shopDirectory = 'themes/shop';
export const shopPreviewDirectory = 'themes/shop-preview';

/** A workspace with the same theme files in `themes/shop` and `themes/shop-preview`. */
export function siblingThemes(files: MockTheme): MockTheme {
  return Object.fromEntries(
    [shopDirectory, shopPreviewDirectory].flatMap((directory) =>
      Object.entries(files).map(([relativePath, source]) => [
        `${directory}/${relativePath}`,
        source,
      ]),
    ),
  );
}
