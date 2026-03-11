import { Facet } from '@codemirror/state';
export const clientFacet = Facet.define({
    combine: (values) => values[0],
    static: true,
});
export const fileUriFacet = Facet.define({
    combine: (values) => values[0],
});
export const serverCapabilitiesFacet = Facet.define({
    combine: (values) => { var _a; return (_a = values[0]) !== null && _a !== void 0 ? _a : {}; },
});
//# sourceMappingURL=client.js.map