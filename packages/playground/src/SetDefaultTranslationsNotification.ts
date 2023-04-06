import { NotificationMessage } from 'vscode-languageserver-protocol';

export const method = 'shopify/setDefaultTranslations';
export interface type extends NotificationMessage {
  method: typeof method;
  params: any;
}
