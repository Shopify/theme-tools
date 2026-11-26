import { Template } from '@shopify/theme-check-common';

/**
 * The text that goes between the quotes of a JSON string to hold `value`. A
 * file name can contain characters such as `"` that JSON must escape.
 */
export function escapeJsonString(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

/** A preset, or the customized `current` settings, in config/settings_data.json */
export interface SettingsDataPreset {
  sections?: Record<string, { type: string }>;
}

export interface SettingsData {
  /** The name of a preset, or the customized settings */
  current?: string | SettingsDataPreset;
  presets?: Record<string, SettingsDataPreset>;
}

export function isValidSettingsData(parsed: unknown): parsed is SettingsData {
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
}

export function isSettingsDataPreset(value: unknown): value is SettingsDataPreset {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// this is very very optimistic...
export function isValidTemplate(parsed: unknown): parsed is Template.Template {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'sections' in parsed &&
    'order' in parsed &&
    Array.isArray((parsed as Template.Template).order)
  );
}

export function isValidSectionGroup(parsed: unknown): parsed is Template.SectionGroup {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'sections' in parsed &&
    'order' in parsed &&
    Array.isArray((parsed as Template.SectionGroup).order)
  );
}
