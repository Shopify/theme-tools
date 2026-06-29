/**
 * Thrown by `loadConfig` when a Theme Check configuration cannot be resolved.
 *
 * Any failure while reading, parsing, or validating the configuration is
 * surfaced as a `ThemeCheckConfigError`, so callers can recognize a
 * configuration problem with a single `instanceof` check (or the stable
 * `code`) instead of matching error messages. The underlying error — a
 * filesystem error, a YAML parse error, a validation error, etc. — is
 * preserved on `cause`, so its `code`, line/column, and message remain
 * available to callers that want the detail.
 */
export class ThemeCheckConfigError extends Error {
  /**
   * Stable discriminator for recognizing this error across module/realm
   * boundaries where `instanceof` can be unreliable (duplicate package copies).
   */
  readonly code = 'THEME_CHECK_CONFIG_ERROR';
  /** The config path or modern identifier that failed to load, when known. */
  readonly configPath?: string;

  constructor(message: string, options: { cause?: unknown; configPath?: string } = {}) {
    super(message, { cause: options.cause });
    this.name = 'ThemeCheckConfigError';
    this.configPath = options.configPath;
  }
}

/**
 * Wraps any error thrown while resolving a configuration in a
 * `ThemeCheckConfigError`, attaching the config path and preserving the
 * original error on `cause`. The original message is surfaced inline so the
 * default output stays useful without unwrapping `cause`.
 */
export function toThemeCheckConfigError(
  error: unknown,
  configPath?: string,
): ThemeCheckConfigError {
  if (error instanceof ThemeCheckConfigError) return error;

  const errno = error instanceof Error ? (error as NodeJS.ErrnoException) : undefined;
  const location = errno?.path ?? configPath;
  const detail = errno?.message ?? String(error);

  return new ThemeCheckConfigError(
    `Failed to load Theme Check configuration${location ? ` from ${location}` : ''}: ${detail}`,
    { cause: error, configPath: location },
  );
}
