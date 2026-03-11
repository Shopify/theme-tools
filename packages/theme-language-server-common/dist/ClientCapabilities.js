"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientCapabilities = void 0;
class ClientCapabilities {
    constructor() {
        this.capabilities = {};
        this.initializationOptions = {};
    }
    setup(capabilities, initializationOptions = {}) {
        this.capabilities = capabilities;
        this.initializationOptions = initializationOptions;
    }
    get hasWorkspaceConfigurationSupport() {
        var _a, _b;
        return !!((_b = (_a = this.capabilities) === null || _a === void 0 ? void 0 : _a.workspace) === null || _b === void 0 ? void 0 : _b.configuration);
    }
    get hasApplyEditSupport() {
        var _a, _b;
        return !!((_b = (_a = this.capabilities) === null || _a === void 0 ? void 0 : _a.workspace) === null || _b === void 0 ? void 0 : _b.applyEdit);
    }
    get hasWorkspaceFoldersSupport() {
        var _a, _b;
        return !!((_b = (_a = this.capabilities) === null || _a === void 0 ? void 0 : _a.workspace) === null || _b === void 0 ? void 0 : _b.workspaceFolders);
    }
    get hasDidChangeConfigurationDynamicRegistrationSupport() {
        var _a, _b, _c;
        return !!((_c = (_b = (_a = this.capabilities) === null || _a === void 0 ? void 0 : _a.workspace) === null || _b === void 0 ? void 0 : _b.didChangeConfiguration) === null || _c === void 0 ? void 0 : _c.dynamicRegistration);
    }
    get hasDidChangeWatchedFilesDynamicRegistrationSupport() {
        var _a, _b, _c;
        return !!((_c = (_b = (_a = this.capabilities) === null || _a === void 0 ? void 0 : _a.workspace) === null || _b === void 0 ? void 0 : _b.didChangeWatchedFiles) === null || _c === void 0 ? void 0 : _c.dynamicRegistration);
    }
    get hasShowDocumentSupport() {
        var _a, _b;
        return !!((_b = (_a = this.capabilities) === null || _a === void 0 ? void 0 : _a.window) === null || _b === void 0 ? void 0 : _b.showDocument);
    }
    get hasProgressSupport() {
        var _a, _b;
        return !!((_b = (_a = this.capabilities) === null || _a === void 0 ? void 0 : _a.window) === null || _b === void 0 ? void 0 : _b.workDoneProgress);
    }
    initializationOption(key, defaultValue) {
        var _a;
        // { 'themeCheck.checkOnSave': true }
        const direct = (_a = this.initializationOptions) === null || _a === void 0 ? void 0 : _a[key];
        if (direct !== undefined)
            return direct;
        // { themeCheck: { checkOnSave: true } }
        const nested = pathGet(this.initializationOptions, key);
        if (nested !== undefined)
            return nested;
        // fallback
        return defaultValue;
    }
}
exports.ClientCapabilities = ClientCapabilities;
function pathGet(obj, key) {
    const path = key.split('.');
    return path.reduce((acc, subpath) => acc === null || acc === void 0 ? void 0 : acc[subpath], obj);
}
//# sourceMappingURL=ClientCapabilities.js.map