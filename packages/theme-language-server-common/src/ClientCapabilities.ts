import { ClientCapabilities as LanguageClientCapabilities } from 'vscode-languageserver';

export class ClientCapabilities {
  private capabilities: LanguageClientCapabilities = {};

  setup(capabilities: LanguageClientCapabilities) {
    this.capabilities = capabilities;
  }

  hasApplyEditSupport() {
    return !!this.capabilities?.workspace?.applyEdit;
  }
}
