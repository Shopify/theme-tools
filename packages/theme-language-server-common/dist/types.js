"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetObjectsNotification = exports.ThemeGraphDidUpdateNotification = exports.ThemeGraphDeadCodeRequest = exports.ThemeGraphRootRequest = exports.ThemeGraphDependenciesRequest = exports.ThemeGraphReferenceRequest = void 0;
const rpc = __importStar(require("vscode-jsonrpc"));
var ThemeGraphReferenceRequest;
(function (ThemeGraphReferenceRequest) {
    ThemeGraphReferenceRequest.method = 'themeGraph/references';
    ThemeGraphReferenceRequest.type = new rpc.RequestType(ThemeGraphReferenceRequest.method);
})(ThemeGraphReferenceRequest || (exports.ThemeGraphReferenceRequest = ThemeGraphReferenceRequest = {}));
var ThemeGraphDependenciesRequest;
(function (ThemeGraphDependenciesRequest) {
    ThemeGraphDependenciesRequest.method = 'themeGraph/dependencies';
    ThemeGraphDependenciesRequest.type = new rpc.RequestType(ThemeGraphDependenciesRequest.method);
})(ThemeGraphDependenciesRequest || (exports.ThemeGraphDependenciesRequest = ThemeGraphDependenciesRequest = {}));
var ThemeGraphRootRequest;
(function (ThemeGraphRootRequest) {
    ThemeGraphRootRequest.method = 'themeGraph/rootUri';
    ThemeGraphRootRequest.type = new rpc.RequestType(ThemeGraphRootRequest.method);
})(ThemeGraphRootRequest || (exports.ThemeGraphRootRequest = ThemeGraphRootRequest = {}));
var ThemeGraphDeadCodeRequest;
(function (ThemeGraphDeadCodeRequest) {
    ThemeGraphDeadCodeRequest.method = 'themeGraph/deadCode';
    ThemeGraphDeadCodeRequest.type = new rpc.RequestType(ThemeGraphDeadCodeRequest.method);
})(ThemeGraphDeadCodeRequest || (exports.ThemeGraphDeadCodeRequest = ThemeGraphDeadCodeRequest = {}));
var ThemeGraphDidUpdateNotification;
(function (ThemeGraphDidUpdateNotification) {
    ThemeGraphDidUpdateNotification.method = 'themeGraph/onDidChangeTree';
    ThemeGraphDidUpdateNotification.type = new rpc.NotificationType(ThemeGraphDidUpdateNotification.method);
})(ThemeGraphDidUpdateNotification || (exports.ThemeGraphDidUpdateNotification = ThemeGraphDidUpdateNotification = {}));
var SetObjectsNotification;
(function (SetObjectsNotification) {
    SetObjectsNotification.method = 'shopify/setObjects';
    SetObjectsNotification.type = new rpc.NotificationType(SetObjectsNotification.method);
})(SetObjectsNotification || (exports.SetObjectsNotification = SetObjectsNotification = {}));
//# sourceMappingURL=types.js.map