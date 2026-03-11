"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachedFileSystem = void 0;
class CachedFileSystem {
    constructor(fs) {
        this.readFile = cachedByUri(fs.readFile.bind(fs));
        this.readDirectory = cachedByUri(fs.readDirectory.bind(fs));
        this.stat = cachedByUri(fs.stat.bind(fs));
    }
}
exports.CachedFileSystem = CachedFileSystem;
function cachedByUri(fn) {
    const cache = new Map();
    function cached(uri) {
        if (!cache.has(uri)) {
            // I'm intentionally leaving this comment here for debugging purposes :)
            // console.error('cache miss', fn.name, uri);
            cache.set(uri, fn(uri));
        }
        return cache.get(uri);
    }
    cached.invalidate = (uri) => {
        // I'm intentionally leaving this comment here for debugging purposes :)
        // console.error('cache invalidate', fn.name, uri);
        cache.delete(uri);
    };
    return cached;
}
//# sourceMappingURL=CachedFileSystem.js.map