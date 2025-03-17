import ts from "typescript";

function isSubPath(
    rootUri: string,
    config: string,
) {
    return config.startsWith(rootUri);
}

export function findJSConfig(
    fileName: string,
    rootUris: string[],
    fileExists: (path: string) => boolean
) {
    const searchDir = fileName.split('/').slice(0, -1).join('/');

    const tsconfig = ts.findConfigFile(searchDir, fileExists, 'tsconfig.json') || '';
    const jsconfig = ts.findConfigFile(searchDir, fileExists, 'jsconfig.json') || '';
    // Prefer closest config file
    const config = tsconfig.length >= jsconfig.length ? tsconfig : jsconfig;

    // Don't return config files that are outside of the current workspace
    return !!config &&
        rootUris.some((rootUri) => isSubPath(rootUri, config)) &&
        !fileName
            .substring(config.length - 'tsconfig.json'.length)
            .split('/')
            .includes('node_modules')
        ? config
        : '';
}