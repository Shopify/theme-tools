"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConvenienceSeverities = exports.LegacyIdentifiers = exports.ModernIdentifiers = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
exports.ModernIdentifiers = [
    'theme-check:nothing',
    'theme-check:recommended',
    'theme-check:theme-app-extension',
    'theme-check:all',
];
exports.LegacyIdentifiers = new Map(Object.entries({
    default: 'theme-check:recommended',
    nothing: 'theme-check:nothing',
    theme_app_extensions: 'theme-check:theme-app-extension',
}));
exports.ConvenienceSeverities = {
    // legacy
    suggestion: theme_check_common_1.Severity.WARNING,
    style: theme_check_common_1.Severity.INFO,
    // the numerical values are not user friendly
    error: theme_check_common_1.Severity.ERROR,
    warning: theme_check_common_1.Severity.WARNING,
    info: theme_check_common_1.Severity.INFO,
};
//# sourceMappingURL=types.js.map