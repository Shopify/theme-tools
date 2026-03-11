import { UriString } from '@shopify/theme-check-common';
import { IDependencies, ThemeGraph } from '../types';
export declare function buildThemeGraph(rootUri: UriString, ideps: IDependencies, entryPoints?: UriString[]): Promise<ThemeGraph>;
