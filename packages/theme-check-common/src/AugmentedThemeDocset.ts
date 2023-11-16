import { FilterEntry, ObjectEntry, TagEntry, ThemeDocset, Translations } from './types';
import { memo } from './utils';

const toFilterEntry = (name: string): FilterEntry => ({ name });
const aliasedFilters = ['camelcase', 'handle', 't'];
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

const toObjectEntry = (name: string): ObjectEntry => ({ name });
const undocumentedObjects = ['customer_address', 'product_variant'];

const toTagEntry = (name: string): TagEntry => ({ name });
const undocumentedTags = ['elsif', 'ifchanged', 'when', 'schema'];

export class AugmentedThemeDocset implements ThemeDocset {
  constructor(private themeDocset: ThemeDocset) {}

  public isAugmented = true;

  filters = memo(async (): Promise<FilterEntry[]> => {
    return [
      ...(await this.themeDocset.filters()),
      ...aliasedFilters.map(toFilterEntry),
      ...undocumentedFilters.map(toFilterEntry),
    ];
  });

  objects = memo(async (): Promise<ObjectEntry[]> => {
    return [...(await this.themeDocset.objects()), ...undocumentedObjects.map(toObjectEntry)];
  });

  tags = memo(async (): Promise<TagEntry[]> => {
    return [...(await this.themeDocset.tags()), ...undocumentedTags.map(toTagEntry)];
  });

  systemTranslations = memo(async (): Promise<Translations> => {
    return this.themeDocset.systemTranslations();
  });
}
