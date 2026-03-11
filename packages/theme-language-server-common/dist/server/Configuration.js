"use strict";
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Configuration = exports.ConfigurationKeys = exports.PRELOAD_ON_BOOT = exports.CHECK_ON_CHANGE = exports.CHECK_ON_SAVE = exports.CHECK_ON_OPEN = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_1 = require("vscode-languageserver");
exports.CHECK_ON_OPEN = 'themeCheck.checkOnOpen';
exports.CHECK_ON_SAVE = 'themeCheck.checkOnSave';
exports.CHECK_ON_CHANGE = 'themeCheck.checkOnChange';
exports.PRELOAD_ON_BOOT = 'themeCheck.preloadOnBoot';
exports.ConfigurationKeys = [
    exports.CHECK_ON_OPEN,
    exports.CHECK_ON_SAVE,
    exports.CHECK_ON_CHANGE,
    exports.PRELOAD_ON_BOOT,
];
class Configuration {
    constructor(connection, capabilities) {
        this.connection = connection;
        this.capabilities = capabilities;
        this[_a] = true;
        this[_b] = true;
        this[_c] = true;
        this[_d] = true;
        this.fetchConfiguration = (0, theme_check_common_1.memo)(async () => {
            if (!this.capabilities.hasWorkspaceConfigurationSupport)
                return;
            const configs = await this.connection.workspace.getConfiguration(exports.ConfigurationKeys.map((key) => ({ section: key })));
            for (let i = 0; i < exports.ConfigurationKeys.length; i++) {
                const key = exports.ConfigurationKeys[i];
                if (configs[i] !== null) {
                    this[key] = configs[i];
                }
            }
        });
        this.registerDidChangeCapability = (0, theme_check_common_1.memo)(async () => {
            if (!this.capabilities.hasDidChangeConfigurationDynamicRegistrationSupport)
                return;
            return this.connection.client.register(vscode_languageserver_1.DidChangeConfigurationNotification.type);
        });
        this.registerDidChangeWatchedFilesNotification = async (options) => {
            if (!this.capabilities.hasDidChangeWatchedFilesDynamicRegistrationSupport)
                return;
            return this.connection.client.register(vscode_languageserver_1.DidChangeWatchedFilesNotification.type, options);
        };
        this.connection = connection;
        this.capabilities = capabilities;
    }
    setup() {
        this[exports.CHECK_ON_OPEN] = this.capabilities.initializationOption(exports.CHECK_ON_OPEN, true);
        this[exports.CHECK_ON_SAVE] = this.capabilities.initializationOption(exports.CHECK_ON_SAVE, true);
        this[exports.CHECK_ON_CHANGE] = this.capabilities.initializationOption(exports.CHECK_ON_CHANGE, true);
        this[exports.PRELOAD_ON_BOOT] = this.capabilities.initializationOption(exports.PRELOAD_ON_BOOT, true);
    }
    async shouldCheckOnOpen() {
        await this.fetchConfiguration();
        return this[exports.CHECK_ON_OPEN];
    }
    async shouldCheckOnSave() {
        await this.fetchConfiguration();
        return this[exports.CHECK_ON_SAVE];
    }
    async shouldCheckOnChange() {
        await this.fetchConfiguration();
        return this[exports.CHECK_ON_CHANGE];
    }
    async shouldPreloadOnBoot() {
        await this.fetchConfiguration();
        return this[exports.PRELOAD_ON_BOOT];
    }
    clearCache() {
        this.fetchConfiguration.clearCache();
    }
}
exports.Configuration = Configuration;
_a = exports.CHECK_ON_OPEN, _b = exports.CHECK_ON_SAVE, _c = exports.CHECK_ON_CHANGE, _d = exports.PRELOAD_ON_BOOT;
//# sourceMappingURL=Configuration.js.map