import { HoverRequest } from 'vscode-languageserver-protocol';
import { clientFacet, fileUriFacet } from './client';
import { textDocumentField } from './textDocumentSync';
import { Facet } from '@codemirror/state';
import { hoverTooltip } from '@codemirror/view';
export const hoverRendererFacet = Facet.define({
    static: true,
    combine: (values) => { var _a; return (_a = values[0]) !== null && _a !== void 0 ? _a : undefined; },
});
export const lspHover = (overrides = {}) => hoverTooltip(hover, {
    ...overrides,
});
export async function hover(view, pos, _side) {
    const client = view.state.facet(clientFacet.reader);
    const fileUri = view.state.facet(fileUriFacet.reader);
    const hoverRenderer = view.state.facet(hoverRendererFacet.reader);
    const textDocument = view.state.field(textDocumentField);
    if (!hoverRenderer)
        return null;
    const result = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: fileUri },
        position: textDocument.positionAt(pos),
    });
    // No results
    if (result === null)
        return null;
    let { from, to, text } = view.state.doc.lineAt(pos);
    let start = pos;
    let end = pos;
    if (result.range) {
        start = textDocument.offsetAt(result.range.start);
        end = textDocument.offsetAt(result.range.end);
    }
    else {
        // basic "current word" algo
        while (start > from && /\w/.test(text[start - from - 1]))
            start--;
        while (end < to && /\w/.test(text[end - from]))
            end++;
    }
    return {
        pos: start,
        end: end,
        above: true,
        create: (view) => hoverRenderer(view, result),
        arrow: false,
    };
}
//# sourceMappingURL=hover.js.map