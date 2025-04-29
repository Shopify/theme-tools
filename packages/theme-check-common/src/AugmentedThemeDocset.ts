import {
  Access,
  FilterEntry,
  ObjectEntry,
  TagEntry,
  ThemeDocset,
  Translations,
  ReturnType,
} from './types';
import { memo } from './utils';

const toFilterEntry = (name: string): FilterEntry => ({ name });
const aliasedFilters: [string, string][] = [
  ['camelcase', 'camelize'],
  ['handle', 'handleize'],
  ['t', 'translate'],
];

const toAliasedFilterEntry =
  (entries: FilterEntry[]) =>
  ([alias, baseName]: [string, string]): FilterEntry => {
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

const toObjectEntry = (name: string, access?: Access, returnType?: ReturnType[]): ObjectEntry => ({
  name,
  ...(access && { access }),
  ...(returnType && { return_type: returnType }),
});

const undocumentedObjects = ['customer_address', 'product_variant'];
const legacyCheckoutEntries: ObjectEntry[] = undocumentedObjectEntryKeys.map((objectKey) =>
  toObjectEntry(objectKey, { global: false, parents: [], template: [] }, [
    { type: 'string', name: '' },
  ]),
);

const toTagEntry = (name: string): TagEntry => ({ name });
const undocumentedTags = ['elsif', 'ifchanged', 'when', 'schema'];

export class AugmentedThemeDocset implements ThemeDocset {
  constructor(private themeDocset: ThemeDocset) {}

  public isAugmented = true;

  filters = memo(async (): Promise<FilterEntry[]> => {
    const officialFilters = await this.themeDocset.filters();
    return [
      ...officialFilters,
      ...aliasedFilters.map(toAliasedFilterEntry(officialFilters)),
      ...undocumentedFilters.map(toFilterEntry),
    ];
  });

  objects = memo(async (): Promise<ObjectEntry[]> => {
    return [
      ...(await this.themeDocset.objects()),
      ...undocumentedObjects.map((obj) => toObjectEntry(obj)),
      ...legacyCheckoutEntries,
    ];
  });

  liquidDrops = memo(async (): Promise<ObjectEntry[]> => {
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

  tags = memo(async (): Promise<TagEntry[]> => {
    return [...(await this.themeDocset.tags()), ...undocumentedTags.map(toTagEntry)];
  });

  systemTranslations = memo(async (): Promise<Translations> => {
    return this.themeDocset.systemTranslations();
  });
}
