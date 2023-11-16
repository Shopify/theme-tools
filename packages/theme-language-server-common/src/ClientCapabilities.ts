import {
  ClientCapabilities as LanguageClientCapabilities,
  InitializeParams,
} from 'vscode-languageserver';

export class ClientCapabilities {
  private capabilities?: LanguageClientCapabilities = {};
  private initializationOptions?: InitializeParams['initializationOptions'] = {};

  setup(
    capabilities: LanguageClientCapabilities,
    initializationOptions: InitializeParams['initializationOptions'] = {},
  ) {
    this.capabilities = capabilities;
    this.initializationOptions = initializationOptions;
  }

  get hasWorkspaceConfigurationSupport() {
    return !!this.capabilities?.workspace?.configuration;
  }

  get hasApplyEditSupport() {
    return !!this.capabilities?.workspace?.applyEdit;
  }

  get hasDidChangeConfigurationDynamicRegistrationSupport() {
    return !!this.capabilities?.workspace?.didChangeConfiguration?.dynamicRegistration;
  }

  initializationOption<T>(key: string, defaultValue: T): T {
    // { 'themeCheck.checkOnSave': true }
    const direct = this.initializationOptions?.[key];
    if (direct !== undefined) return direct;

    // { themeCheck: { checkOnSave: true } }
    const nested = pathGet<T>(this.initializationOptions, key);
    if (nested !== undefined) return nested;

    // fallback
    return defaultValue;
  }
}

function pathGet<T>(obj: any, key: string): T | undefined {
  const path = key.split('.');
  return path.reduce((acc, subpath) => acc?.[subpath], obj);
}
