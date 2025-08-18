/**
 * Returns the default batch size to use for file system operations.
 *
 * Resolution order:
 * - globalThis.__THEME_FS_BATCH_SIZE__ (set programmatically at runtime)
 * - process.env.THEME_FS_BATCH_SIZE or process.env.THEME_TOOLS_BATCH_SIZE (Node only)
 * - fallback default (20)
 */
export function getFileSystemBatchSize(): number {
  // 1) Global runtime override (works in browser and Node)
  const globalOverride = (globalThis as any).__THEME_FS_BATCH_SIZE__;
  if (typeof globalOverride === 'number' && Number.isFinite(globalOverride) && globalOverride > 0) {
    return Math.floor(globalOverride);
  }

  // 2) Environment variables (Node only). Wrapped in try/catch for browser safety
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeProcess: any = (globalThis as any).process;
    const envValue: string | undefined =
      nodeProcess?.env?.THEME_FS_BATCH_SIZE ?? nodeProcess?.env?.THEME_TOOLS_BATCH_SIZE;
    if (envValue) {
      const parsed = Number(envValue);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.floor(parsed);
      }
    }
  } catch (_e) {
    // ignore — not in Node or env unavailable
  }

  // 3) Fallback
  return 20;
}

/**
 * Sets the global batch size override at runtime.
 * Useful for tuning on constrained devices or power desktops.
 */
export function setFileSystemBatchSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) return;
  (globalThis as any).__THEME_FS_BATCH_SIZE__ = Math.floor(size);
}



