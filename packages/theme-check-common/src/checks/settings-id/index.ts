import { parseJSON } from '../../json';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isError } from '../../utils';

const SETTINGS_PATH_REGEX = /\b(?:\w+\.)?settings\.[\w.]+/g;

export const SettingsId: LiquidCheckDefinition = {
  meta: {
    code: 'SettingsId',
    name: 'Validate settings IDs demo for lunch and learn',
    docs: {
      description: 'To validate settings ID paths within a schema',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/missing-asset',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    let schemaSettings: any;
    const filePath = context.relativePath(context.file.absolutePath);
    const bucket = extractFirstSubstring(filePath, '/');
    const expectedLocalSettingsPath = `${toSingular(bucket)}.settings`;

    // Collect all the settings paths as the file is being parsed so that they may be evaluated against the schema at the end
    const settingsPaths: SettingsPathInfo[] = [];

    /**
     * Parses all settings paths from a given node and appends them to the settingsPaths array.
     * Assumes `node.source` is a string and `node.position` contains start and end indices.
     *
     * @param {any} node - The node object containing the source string and position.
     * @param {Array<Object>} settingsPaths - An array to which parsed settings paths are added.
     */
    function parseAllSettingsPaths(node: any) {
      const nodeSubstring = node.source.substring(node.position.start, node.position.end);
      const matches = nodeSubstring.matchAll(SETTINGS_PATH_REGEX);

      for (const match of matches) {
        if (match.index !== undefined) {
          const settingsPath = match[0];
          const startIndex = match.index + node.position.start;
          const endIndex = startIndex + settingsPath.length;
          settingsPaths.push({ settingsPath, startIndex, endIndex });
        }
      }
    }

    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }
        const schema = parseJSON(node.body.value);
        if (isError(schema) && schema instanceof SyntaxError) return;

        schemaSettings = schema?.settings;
      },

      async LiquidVariable(node) {
        parseAllSettingsPaths(node);
      },
      async LiquidTag(node) {
        parseAllSettingsPaths(node);
      },

      async onCodePathEnd() {
        for (const settingsPathInfo of settingsPaths) {
          const { settingsPath, startIndex, endIndex } = settingsPathInfo;
          const isGlobalSettings = settingsPath.startsWith('settings.');
          if (isGlobalSettings) {
            // TODO: Implement me. Wiring into settings_schema.json is a bit too complex for the scope of this exercise
            continue;
          }

          const isLocalSettingsPathValid = settingsPath.startsWith(expectedLocalSettingsPath);
          if (!isLocalSettingsPathValid) {
            context.report({
              message: `Local settings path is invalid. It should start with '${expectedLocalSettingsPath}'.`,
              startIndex,
              endIndex,
            });

            continue;
          }

          // Edge case: The local settings path is valid, but the schema is not defined
          if (!schemaSettings) {
            // We cannot confirm local setting existence without a schema
            context.report({
              message: `Local settings must be defined in the schema.`,
              startIndex,
              endIndex,
            });

            continue;
          }

          // At this point, we know that the path is a valid local settings path structure
          // We can verify whether the setting exists in the locally defined schema

          const pathWithoutPrefix = settingsPath.replace(expectedLocalSettingsPath, '');
          const settingId = extractFirstSubstring(pathWithoutPrefix, '.');
          const settingExists = schemaSettings.some(({ id }: any) => id === settingId);
          if (!settingExists) {
            context.report({
              message: `Local setting id '${settingId}' is not defined in the schema.`,
              startIndex,
              endIndex,
            });
          }
        }
      },
    };
  },
};

interface SettingsPathInfo {
  settingsPath: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Extracts the first substring from a given string path.
 * @param path - The input string path.
 * @returns The first substring of the path or an empty string if not found.
 */
const extractFirstSubstring = (path: string, token: string): string => {
  // Split the path by '/'
  const segments = path.split(token);

  // Find the first non-empty segment
  for (const segment of segments) {
    if (segment.trim().length > 0) {
      return segment.trim();
    }
  }

  // Return an empty string if no valid segment is found
  return '';
};

/**
 * Converts a plural noun to its singular form by removing the trailing 's'.
 * This function assumes the plural is formed by simply adding an 's' at the end,
 * which may not be accurate for all English nouns.
 *
 * @param {string} word - The plural word to convert to singular.
 * @returns {string} The singular form of the word, or the original word if it does not end in 's'.
 */
function toSingular(word: string) {
  if (word.endsWith('s')) {
    return word.slice(0, -1);
  }
  return word;
}
