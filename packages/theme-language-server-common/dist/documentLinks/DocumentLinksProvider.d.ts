import { DocumentLink } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
import { FindThemeRootURI } from '../internal-types';
export declare class DocumentLinksProvider {
    private documentManager;
    private findThemeRootURI;
    constructor(documentManager: DocumentManager, findThemeRootURI: FindThemeRootURI);
    documentLinks(uriString: string): Promise<DocumentLink[]>;
}
