import { AbstractFileSystem, FileStat, FileTuple } from '../AbstractFileSystem';
import { MockTheme } from './MockTheme';
export declare class MockFileSystem implements AbstractFileSystem {
    private mockTheme;
    private rootUri;
    constructor(mockTheme: MockTheme, rootUri?: string);
    readFile(uri: string): Promise<string>;
    readDirectory(uri: string): Promise<FileTuple[]>;
    stat(uri: string): Promise<FileStat>;
    private get fileTree();
    private rootRelative;
}
