/**
 * Generate a patch changeset for a package.
 *
 * This is a workaround because we cannot use `changeset add` programmatically.
 *
 */
export declare const generatePatchChangeset: (pkgName: string, updatedDeps: string[]) => Promise<void>;
