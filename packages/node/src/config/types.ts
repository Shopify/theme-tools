import { ChecksSettings, Severity } from '@shopify/theme-check-common';

export type FullyResolvedThemeCheckYaml = Omit<ThemeCheckYaml, 'extends'> & { extends: [] };
export interface ThemeCheckYaml {
  root?: string;
  ignore: string[];
  extends: string[];
  checkSettings: ChecksSettings;
}

export const ModernIdentifiers = [
  'theme-check:recommended',
  'theme-check:theme-app-extension',
  'theme-check:all',
] as const;

export type ModernIdentifier = (typeof ModernIdentifiers)[number];

export const LegacyIdentifiers = new Map(
  Object.entries({
    default: 'theme-check:recommended',
    nothing: undefined,
    theme_app_extensions: 'theme-check:theme-app-extension',
  }),
);

export type LegacySeverity = 'error' | 'suggestion' | 'style';

export const LegacySeverities: { [k in LegacySeverity]: Severity } = {
  error: Severity.ERROR,
  suggestion: Severity.WARNING,
  style: Severity.INFO,
};
