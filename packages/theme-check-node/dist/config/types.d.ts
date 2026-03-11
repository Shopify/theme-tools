import { ChecksSettings, Mode, Severity } from '@shopify/theme-check-common';
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
    require: string[];
    checkSettings: ChecksSettings;
    context?: Mode;
}
/** A ConfigDescription is a ConfigFragment that doesn't extend anything. */
export type ConfigDescription = Omit<ConfigFragment, 'extends' | 'context'> & {
    extends: [];
    context: Mode;
};
export declare const ModernIdentifiers: readonly ["theme-check:nothing", "theme-check:recommended", "theme-check:theme-app-extension", "theme-check:all"];
export type ModernIdentifier = (typeof ModernIdentifiers)[number];
export declare const LegacyIdentifiers: Map<string, string>;
export type ConvenienceSeverity = 'error' | 'suggestion' | 'style' | 'warning' | 'info';
export declare const ConvenienceSeverities: {
    [k in ConvenienceSeverity]: Severity;
};
