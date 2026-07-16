import {
  Severity,
  SourceCodeType,
  type JSONCheckDefinition,
  type LiquidCheckDefinition,
} from '../../types';

const KILOBYTE = 1024;
const MEGABYTE = 1024 * KILOBYTE;
const DRAFTS_DIRECTORY = '_drafts';
const FULL_FILE_BYTES = 'full-file-bytes';
const SCHEMALESS_BYTES = 'schemaless-bytes';

type MaxFileSizeMeasurement = typeof FULL_FILE_BYTES | typeof SCHEMALESS_BYTES;

type MaxFileSizeLimit = {
  bytes: number;
  measurement: MaxFileSizeMeasurement;
};

type MaxFileSizeLimitKey = keyof typeof MAX_FILE_SIZE_LIMITS;

/*
 * Shopify core parity for per-file theme limits:
 */
/* prettier-ignore */ /// ignoring Prettier here to keep comments readable.
const MAX_FILE_SIZE_LIMITS = {
  assets:                        { bytes:  20.0 * MEGABYTE, measurement: FULL_FILE_BYTES },
  locales:                       { bytes:   1.5 * MEGABYTE, measurement: SCHEMALESS_BYTES },
  "config/settings_data.json":   { bytes:   1.5 * MEGABYTE, measurement: SCHEMALESS_BYTES },
  "config/settings_schema.json": { bytes: 512.0 * KILOBYTE, measurement: SCHEMALESS_BYTES },
  "templates/*.json":            { bytes: 512.0 * KILOBYTE, measurement: SCHEMALESS_BYTES },
  "sections/*.json":             { bytes: 512.0 * KILOBYTE, measurement: SCHEMALESS_BYTES },
  blocks:                        { bytes: 256.0 * KILOBYTE, measurement: SCHEMALESS_BYTES },
  config:                        { bytes: 256.0 * KILOBYTE, measurement: SCHEMALESS_BYTES },
  layout:                        { bytes: 256.0 * KILOBYTE, measurement: SCHEMALESS_BYTES },
  snippets:                      { bytes: 256.0 * KILOBYTE, measurement: SCHEMALESS_BYTES },
  templates:                     { bytes: 256.0 * KILOBYTE, measurement: SCHEMALESS_BYTES },
  sections:                      { bytes: 256.0 * KILOBYTE, measurement: SCHEMALESS_BYTES },
} as const satisfies Record<string, MaxFileSizeLimit>;

const MAX_FILE_SIZE_LIMIT_KEYS = Object.keys(MAX_FILE_SIZE_LIMITS) as MaxFileSizeLimitKey[];

const SCHEMA_BLOCK_REGEX = /{%-?\s*schema\s*-?%}[\s\S]*?{%-?\s*endschema\s*-?%}/g;

export const MaxFileSize: LiquidCheckDefinition = {
  meta: {
    code: 'MaxFileSize',
    name: 'MaxFileSize',
    docs: {
      description: "Reports theme files that exceed Shopify's maximum file size.",
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async onCodePathStart() {
        const limit = maxFileSizeLimit(context.toRelativePath(context.file.uri));
        if (!limit) return;

        const measuredBytes = measuredFileBytes(context.file.source, limit.measurement);
        if (measuredBytes <= limit.bytes) return;

        context.report({
          message: `Theme file is too large. It is ${formatBytes(measuredBytes)} but the limit is ${formatBytes(limit.bytes)}.`,
          startIndex: 0,
          endIndex: context.file.source.length,
        });
      },
    };
  },
};

function maxFileSizeLimit(relativePath: string): MaxFileSizeLimit | undefined {
  if (relativePath === DRAFTS_DIRECTORY || relativePath.startsWith(`${DRAFTS_DIRECTORY}/`)) {
    return undefined;
  }

  const key = maxFileSizeLimitKey(relativePath);
  if (!key) return undefined;

  return MAX_FILE_SIZE_LIMITS[key];
}

function maxFileSizeLimitKey(relativePath: string): MaxFileSizeLimitKey | undefined {
  return MAX_FILE_SIZE_LIMIT_KEYS.find((key) => {
    if (key.endsWith('*.json')) {
      const [prefix, extension] = key.split('*');
      return (
        matchesThemePathPrefix(relativePath, prefix) &&
        relativePath.toLowerCase().endsWith(extension)
      );
    }

    return matchesThemePath(relativePath, key);
  });
}

function matchesThemePath(relativePath: string, themePath: string): boolean {
  return (
    relativePath === themePath ||
    relativePath.startsWith(`${themePath}/`) ||
    relativePath.endsWith(`/${themePath}`) ||
    relativePath.includes(`/${themePath}/`)
  );
}

function matchesThemePathPrefix(relativePath: string, themePathPrefix: string): boolean {
  return relativePath.startsWith(themePathPrefix) || relativePath.includes(`/${themePathPrefix}`);
}

function measuredFileBytes(source: string, measurement: MaxFileSizeLimit['measurement']): number {
  if (measurement === FULL_FILE_BYTES) {
    return Buffer.byteLength(source);
  }

  const schemaBytes = [...source.matchAll(SCHEMA_BLOCK_REGEX)].reduce(
    (bytes, match) => bytes + Buffer.byteLength(match[0]),
    0,
  );
  return Buffer.byteLength(source) - schemaBytes;
}

function formatBytes(bytes: number): string {
  if (bytes % MEGABYTE === 0) {
    return `${bytes / MEGABYTE} MB`;
  }

  if (bytes % KILOBYTE === 0) {
    return `${bytes / KILOBYTE} KB`;
  }

  return `${bytes} bytes`;
}

export const MaxFileSizeJSON: JSONCheckDefinition = {
  ...MaxFileSize,
  meta: { ...MaxFileSize.meta, type: SourceCodeType.JSON },
} as unknown as JSONCheckDefinition;
