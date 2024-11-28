import { JSONPath, MarkedString } from 'vscode-json-languageservice';
import { RequestContext } from '../RequestContext';

export interface JSONHoverProvider {
  /** Must be sync because of weird JSONWorkerContribution API */
  canHover(context: RequestContext, location: JSONPath): boolean;
  hover(context: RequestContext, location: JSONPath): Promise<MarkedString[]>;
}
