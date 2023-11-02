export type GetThemeSettingsSchemaForURI = (uri: string) => Promise<SettingsSchemaJSONFile>;

export type SettingsSchemaJSONFile = (ThemeInfo | SettingsCategory)[];

export interface ThemeInfo {
  name: string;
  theme_name: string;
  theme_author: string;
  theme_version: string;
  theme_documentation_url: string;
  theme_support_url?: string;
  theme_support_email?: string;
}

export interface SettingsCategory {
  name: string;
  settings: Setting[];
}

export type Setting = SideBarSetting | InputSetting;

export interface SideBarSetting {
  type: string;
  content: string;
}

export interface InputSetting {
  type: string;
  id: string;
  label: string;
  default?: number | string | boolean | string[];
  info?: string;
}

interface Option {
  label: string;
  value: string;
}

interface MaybeGroupedOption extends Option {
  group?: string;
}

export function isSettingsCategory(x: ThemeInfo | SettingsCategory): x is SettingsCategory {
  return 'settings' in x;
}

export function isInputSetting(x: Setting): x is InputSetting {
  return 'id' in x && 'type' in x && 'label' in x;
}
