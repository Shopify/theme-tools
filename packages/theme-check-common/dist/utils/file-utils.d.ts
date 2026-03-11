import { Context, SourceCodeType, Schema, RelativePath } from '../types';
export declare function doesFileExist<T extends SourceCodeType, S extends Schema>(context: Context<T, S>, relativePath: RelativePath): Promise<boolean>;
export declare function doesFileExceedThreshold<T extends SourceCodeType, S extends Schema>(context: Context<T, S>, relativePath: RelativePath, thresholdInBytes: number): Promise<[exceeds: boolean, fileSize: number]>;
export declare function getFileSize(url: string): Promise<number>;
export declare function hasRemoteAssetSizeExceededThreshold(url: string, thresholdInBytes: number): Promise<boolean>;
export declare function hasLocalAssetSizeExceededThreshold<T extends SourceCodeType, S extends Schema>(context: Context<T, S>, relativePath: RelativePath, thresholdInBytes: number): Promise<boolean>;
