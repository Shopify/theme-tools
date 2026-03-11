"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.render = render;
exports.renderHtmlEntry = renderHtmlEntry;
const TypeSystem_1 = require("../TypeSystem");
const HORIZONTAL_SEPARATOR = '\n\n---\n\n';
function render(entry, returnType, docsetEntryType) {
    return [title(entry, returnType), docsetEntryBody(entry, returnType, docsetEntryType)]
        .filter(Boolean)
        .join('\n');
}
function renderHtmlEntry(entry, parentEntry) {
    return [title(entry, TypeSystem_1.Unknown), htmlEntryBody(entry, parentEntry)].join('\n');
}
function title(entry, returnType) {
    returnType = returnType !== null && returnType !== void 0 ? returnType : (0, TypeSystem_1.docsetEntryReturnType)(entry, TypeSystem_1.Unknown);
    if ((0, TypeSystem_1.isArrayType)(returnType)) {
        return `### ${entry.name}: \`${returnType.valueType}[]\``;
    }
    else if (returnType !== TypeSystem_1.Unknown) {
        return `### ${entry.name}: \`${returnType}\``;
    }
    return `### ${entry.name}`;
}
function sanitize(s) {
    return s === null || s === void 0 ? void 0 : s.replace(/(^|\n+)&gt;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\]\(\//g, '](https://shopify.dev/').trim();
}
function docsetEntryBody(entry, returnType, docsetEntryType) {
    return [
        syntax(entry),
        entry.deprecation_reason,
        entry.summary,
        entry.description,
        shopifyDevReference(entry, returnType, docsetEntryType),
    ]
        .map(sanitize)
        .filter(Boolean)
        .join(HORIZONTAL_SEPARATOR);
}
function htmlEntryBody(entry, parentEntry) {
    return [description(entry), references(entry), references(parentEntry)]
        .filter(Boolean)
        .join(HORIZONTAL_SEPARATOR);
}
function syntax(entry) {
    if (!('syntax' in entry) || !entry.syntax) {
        return undefined;
    }
    // TagEntry entries already have liquid tags as a part of the syntax
    // explanation so we can return them directly.
    if (entry.syntax.startsWith('{%')) {
        return `\`\`\`liquid\n${entry.syntax}\n\`\`\``;
    }
    // Wrap the syntax in liquid tags to ensure we get proper syntax highlighting
    // if it's available.
    return `\`\`\`liquid\n{{ ${entry.syntax} }}\n\`\`\``;
}
function description(entry) {
    if (!entry.description || typeof entry.description === 'string') {
        return entry.description;
    }
    return entry.description.value;
}
const shopifyDevRoot = `https://shopify.dev/docs/api/liquid`;
function shopifyDevReference(entry, returnType, docsetEntryType) {
    switch (docsetEntryType) {
        case 'tag': {
            if (entry.name === 'else' && 'category' in entry) {
                return `[Shopify Reference](${shopifyDevRoot}/tags/${entry.category}-${entry.name})`;
            }
            else if ('category' in entry) {
                return `[Shopify Reference](${shopifyDevRoot}/tags/${entry.name})`;
            }
            else {
                return undefined;
            }
        }
        case 'object': {
            if (!returnType) {
                return `[Shopify Reference](${shopifyDevRoot}/objects/${entry.name})`;
            }
            else if ((0, TypeSystem_1.isArrayType)(returnType)) {
                return `[Shopify Reference](${shopifyDevRoot}/objects/${returnType.valueType})`;
            }
            else if ('access' in entry) {
                return `[Shopify Reference](${shopifyDevRoot}/objects/${returnType})`;
            }
            else {
                return undefined;
            }
        }
        case 'filter': {
            if ('category' in entry) {
                return `[Shopify Reference](${shopifyDevRoot}/filters/${entry.name})`;
            }
            else {
                return undefined;
            }
        }
        default: {
            return undefined;
        }
    }
}
function references(entry) {
    if (!entry || !('references' in entry) || !entry.references || entry.references.length === 0) {
        return undefined;
    }
    if (entry.references.length === 1) {
        const [ref] = entry.references;
        return `[${ref.name}](${ref.url})`;
    }
    return [`#### Learn more`, entry.references.map((ref) => `- [${ref.name}](${ref.url})`)].join('\n\n');
}
//# sourceMappingURL=MarkdownRenderer.js.map