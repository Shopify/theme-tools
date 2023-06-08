import { ChecksSettings, Severity } from '@shopify/theme-check-common';

/**
 * The pipeline goes like this:
 *
 * File                   # the input file as a string
 * -> ConfigFragment      # an intermediate representation of the file
 * -> ConfigFragment[]    # the file and its extends
 * -> ConfigDescription   # the flattened config (no extends)
 * -> Config              # the theme check config
 *
 * Our goal is to support more than one config file format, so what we'll
 * do is have one adapter per file format that outputs a ConfigFragment.
 *
 * Then we'll be able to merge all the config fragments, independently of
 * which file format used.
 */
export interface ConfigFragment {
  root?: string;
  ignore: string[];
  extends: string[];
  checkSettings: ChecksSettings;
}

/** A ConfigDescription is a ConfigFragment that doesn't extend anything. */
export type ConfigDescription = Omit<ConfigFragment, 'extends'> & { extends: [] };

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

export type ConvenienceSeverity = 'error' | 'suggestion' | 'style' | 'warning' | 'info';

export const ConvenienceSeverities: { [k in ConvenienceSeverity]: Severity } = {
  // legacy
  suggestion: Severity.WARNING,
  style: Severity.INFO,

  // the numerical values are not user friendly
  error: Severity.ERROR,
  warning: Severity.WARNING,
  info: Severity.INFO,
};
