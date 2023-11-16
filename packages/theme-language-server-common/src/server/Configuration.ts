import { memo } from '@shopify/theme-check-common';
import { Connection, DidChangeConfigurationNotification } from 'vscode-languageserver';
import { ClientCapabilities } from '../ClientCapabilities';

export const CHECK_ON_OPEN = 'themeCheck.checkOnOpen' as const;
export const CHECK_ON_SAVE = 'themeCheck.checkOnSave' as const;
export const CHECK_ON_CHANGE = 'themeCheck.checkOnChange' as const;
export const ConfigurationKeys = [CHECK_ON_OPEN, CHECK_ON_SAVE, CHECK_ON_CHANGE] as const;

export class Configuration {
  [CHECK_ON_OPEN]: boolean = true;
  [CHECK_ON_SAVE]: boolean = true;
  [CHECK_ON_CHANGE]: boolean = true;

  constructor(private connection: Connection, private capabilities: ClientCapabilities) {
    this.connection = connection;
    this.capabilities = capabilities;
  }

  setup() {
    this[CHECK_ON_OPEN] = this.capabilities.initializationOption(CHECK_ON_OPEN, true);
    this[CHECK_ON_SAVE] = this.capabilities.initializationOption(CHECK_ON_SAVE, true);
    this[CHECK_ON_CHANGE] = this.capabilities.initializationOption(CHECK_ON_CHANGE, true);
  }

  async shouldCheckOnOpen() {
    await this.fetchConfiguration();
    return this[CHECK_ON_OPEN];
  }

  async shouldCheckOnSave() {
    await this.fetchConfiguration();
    return this[CHECK_ON_SAVE];
  }

  async shouldCheckOnChange() {
    await this.fetchConfiguration();
    return this[CHECK_ON_CHANGE];
  }

  clearCache() {
    this.fetchConfiguration.clearCache();
  }

  fetchConfiguration = memo(async () => {
    if (!this.capabilities.hasWorkspaceConfigurationSupport) return;

    const configs = await this.connection.workspace.getConfiguration(
      ConfigurationKeys.map((key) => ({ section: key })),
    );

    for (let i = 0; i < ConfigurationKeys.length; i++) {
      const key = ConfigurationKeys[i];
      if (configs[i] !== null) {
        this[key] = configs[i];
      }
    }
  });

  registerDidChangeCapability = memo(async () => {
    if (!this.capabilities.hasDidChangeConfigurationDynamicRegistrationSupport) return;
    return this.connection.client.register(DidChangeConfigurationNotification.type);
  });
}
