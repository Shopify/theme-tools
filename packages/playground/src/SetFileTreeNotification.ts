import { NotificationMessage } from 'vscode-languageserver-protocol';

type AbsolutePath = string;
export const method = 'shopify/setFileTree';
export interface type extends NotificationMessage {
  method: typeof method;
  params: AbsolutePath[];
}
