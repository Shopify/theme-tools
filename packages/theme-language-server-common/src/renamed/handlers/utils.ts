import { Template } from '@shopify/theme-check-common';

export interface SettingsDataPreset {
  sections?: Record<string, { type: string }>;
}

export interface SettingsData {
  presets?: Record<string, SettingsDataPreset>;
}

export function isValidSettingsData(parsed: unknown): parsed is SettingsData {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'presets' in parsed &&
    typeof (parsed as SettingsData).presets === 'object'
  );
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
