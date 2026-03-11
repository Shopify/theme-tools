"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AugmentedThemeDocset = void 0;
const utils_1 = require("./utils");
const toFilterEntry = (name) => ({ name });
const aliasedFilters = [
    ['camelcase', 'camelize'],
    ['handle', 'handleize'],
    ['t', 'translate'],
];
const toAliasedFilterEntry = (entries) => ([alias, baseName]) => {
    const baseEntry = entries.find((entry) => entry.name === baseName);
    if (!baseEntry) {
        return toFilterEntry(alias);
    }
    return {
        ...baseEntry,
        name: alias,
    };
};
const undocumentedFilters = [
    '_online_store_editor_live_setting',
    'addresses_url',
    'app_block_path?',
    'app_block_path_for',
    'app_extension_path?',
    'app_snippet_path?',
    'cancel_customer_order_link',
    'debug',
    'delete_customer_address_link',
    'dev_shop?',
    'distance_from',
    'edit_customer_address_link',
    'encode_url_component',
    'excerpt',
    'format_code',
    'global_block_type?',
    'h',
    'handle_from',
    'installments_pricing',
    'link_to_theme',
    'login_button',
    'login_url',
    'logout_url',
    'pad_spaces',
    'paragraphize',
    'recover_password_link',
    'recover_url',
    'register_url',
    'registration_uuid_from',
    'root_account_url',
    'sentence',
    'theme_url',
    'unit',
    'weight',
];
const undocumentedObjectEntryKeys = [
    'locale',
    'direction',
    'skip_to_content_link',
    'checkout_html_classes',
    'checkout_stylesheets',
    'checkout_scripts',
    'content_for_logo',
    'breadcrumb',
    'order_summary_toggle',
    'content_for_order_summary',
    'alternative_payment_methods',
    'content_for_footer',
    'tracking_code',
];
const toObjectEntry = (name, access, returnType) => ({
    name,
    ...(access && { access }),
    ...(returnType && { return_type: returnType }),
});
const undocumentedObjects = ['customer_address', 'product_variant'];
const legacyCheckoutEntries = undocumentedObjectEntryKeys.map((objectKey) => toObjectEntry(objectKey, { global: false, parents: [], template: [] }, [
    { type: 'string', name: '' },
]));
const toTagEntry = (name) => ({ name });
const undocumentedTags = ['elsif', 'ifchanged', 'when', 'schema'];
class AugmentedThemeDocset {
    constructor(themeDocset) {
        this.themeDocset = themeDocset;
        this.isAugmented = true;
        this.objectsByPrefix = new Map();
        this.filters = (0, utils_1.memo)(async () => {
            const officialFilters = await this.themeDocset.filters();
            return [
                ...officialFilters,
                ...aliasedFilters.map(toAliasedFilterEntry(officialFilters)),
                ...undocumentedFilters.map(toFilterEntry),
            ];
        });
        this.objects = (0, utils_1.memo)(async () => {
            return [
                ...(await this.themeDocset.objects()),
                ...undocumentedObjects.map((obj) => toObjectEntry(obj)),
                ...legacyCheckoutEntries,
            ];
        });
        this.liquidDrops = (0, utils_1.memo)(async () => {
            return (await this.themeDocset.objects()).filter((obj) => {
                if (!obj.access) {
                    return true;
                }
                if (obj.deprecated) {
                    return false;
                }
                // objects that are accessible outside Global context
                return !obj.access.global || (obj.access.global && obj.access.parents.length > 0);
            });
        });
        this.tags = (0, utils_1.memo)(async () => {
            return [...(await this.themeDocset.tags()), ...undocumentedTags.map(toTagEntry)];
        });
        this.systemTranslations = (0, utils_1.memo)(async () => {
            return this.themeDocset.systemTranslations();
        });
    }
    setObjectsForURI(uri, objects) {
        this.objectsByPrefix.set(uri, objects);
    }
    getObjectsForURI(uri) {
        // Exact match first
        const exact = this.objectsByPrefix.get(uri);
        if (exact)
            return exact;
        // Prefix match: allows registering by step path and matching file URIs within it
        for (const [prefix, objects] of this.objectsByPrefix) {
            if (uri.startsWith(prefix))
                return objects;
        }
        return undefined;
    }
}
exports.AugmentedThemeDocset = AugmentedThemeDocset;
//# sourceMappingURL=AugmentedThemeDocset.js.map