//! `ThemeDocset` + `AugmentedThemeDocset`. Entries stay JSON values (theme-liquid-docs shapes:
//! `FilterEntry`, `ObjectEntry`, `TagEntry`), so checks read fields like TS does.

use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::OnceLock;

pub struct ThemeDocset {
    pub filters: Vec<Value>,
    pub objects: Vec<Value>,
    pub liquid_drops: Vec<Value>,
    pub tags: Vec<Value>,
    pub system_translations: Map<String, Value>,
    filter_index: OnceLock<HashMap<String, usize>>,
    object_index: OnceLock<HashMap<String, usize>>,
    tag_index: OnceLock<HashMap<String, usize>>,
}

const ALIASED_FILTERS: &[(&str, &str)] = &[
    ("camelcase", "camelize"),
    ("handle", "handleize"),
    ("t", "translate"),
];

const UNDOCUMENTED_FILTERS: &[&str] = &[
    "_online_store_editor_live_setting",
    "addresses_url",
    "app_block_path?",
    "app_block_path_for",
    "app_extension_path?",
    "app_snippet_path?",
    "cancel_customer_order_link",
    "debug",
    "delete_customer_address_link",
    "dev_shop?",
    "distance_from",
    "edit_customer_address_link",
    "encode_url_component",
    "excerpt",
    "format_code",
    "global_block_type?",
    "h",
    "handle_from",
    "installments_pricing",
    "link_to_theme",
    "login_button",
    "login_url",
    "logout_url",
    "pad_spaces",
    "paragraphize",
    "recover_password_link",
    "recover_url",
    "register_url",
    "registration_uuid_from",
    "root_account_url",
    "sentence",
    "theme_url",
    "unit",
    "weight",
];

const UNDOCUMENTED_OBJECTS: &[&str] = &["customer_address", "product_variant"];

const LEGACY_CHECKOUT_OBJECTS: &[&str] = &[
    "locale",
    "direction",
    "skip_to_content_link",
    "checkout_html_classes",
    "checkout_stylesheets",
    "checkout_scripts",
    "content_for_logo",
    "breadcrumb",
    "order_summary_toggle",
    "content_for_order_summary",
    "alternative_payment_methods",
    "content_for_footer",
    "tracking_code",
];

const UNDOCUMENTED_TAGS: &[&str] = &["elsif", "ifchanged", "when", "schema"];

fn name_of(v: &Value) -> Option<&str> {
    v.get("name").and_then(Value::as_str)
}

fn index(entries: &[Value]) -> HashMap<String, usize> {
    let mut m = HashMap::new();
    for (i, e) in entries.iter().enumerate() {
        if let Some(n) = name_of(e) {
            m.entry(n.to_string()).or_insert(i);
        }
    }
    m
}

impl ThemeDocset {
    /// `new AugmentedThemeDocset(base)` from the base docset's lists.
    pub fn augmented(
        filters: Vec<Value>,
        objects: Vec<Value>,
        tags: Vec<Value>,
        system_translations: Map<String, Value>,
    ) -> Self {
        let mut all_filters = filters.clone();
        for (alias, base) in ALIASED_FILTERS {
            all_filters.push(match filters.iter().find(|f| name_of(f) == Some(base)) {
                Some(Value::Object(m)) => {
                    let mut m = m.clone();
                    m.insert("name".into(), (*alias).into());
                    Value::Object(m)
                }
                _ => json!({ "name": alias }),
            });
        }
        all_filters.extend(UNDOCUMENTED_FILTERS.iter().map(|n| json!({ "name": n })));

        // liquidDrops: official objects without access, or non-deprecated and not global-only.
        let liquid_drops = objects
            .iter()
            .filter(|o| {
                let Some(access) = o.get("access").filter(|a| crate::json::truthy(a)) else {
                    return true;
                };
                if o.get("deprecated").is_some_and(crate::json::truthy) {
                    return false;
                }
                let global = access.get("global").is_some_and(crate::json::truthy);
                let parents = access
                    .get("parents")
                    .and_then(Value::as_array)
                    .map_or(0, Vec::len);
                !global || parents > 0
            })
            .cloned()
            .collect();

        let mut all_objects = objects;
        all_objects.extend(UNDOCUMENTED_OBJECTS.iter().map(|n| json!({ "name": n })));
        all_objects.extend(LEGACY_CHECKOUT_OBJECTS.iter().map(|n| {
            json!({
                "name": n,
                "access": { "global": false, "parents": [], "template": [] },
                "return_type": [{ "type": "string", "name": "" }],
            })
        }));

        let mut all_tags = tags;
        all_tags.extend(UNDOCUMENTED_TAGS.iter().map(|n| json!({ "name": n })));

        ThemeDocset {
            filters: all_filters,
            objects: all_objects,
            liquid_drops,
            tags: all_tags,
            system_translations,
            filter_index: OnceLock::new(),
            object_index: OnceLock::new(),
            tag_index: OnceLock::new(),
        }
    }

    /// `filters.find((f) => f.name === name)`
    pub fn filter(&self, name: &str) -> Option<&Value> {
        self.filter_index
            .get_or_init(|| index(&self.filters))
            .get(name)
            .map(|&i| &self.filters[i])
    }

    /// `objects.find((o) => o.name === name)`
    pub fn object(&self, name: &str) -> Option<&Value> {
        self.object_index
            .get_or_init(|| index(&self.objects))
            .get(name)
            .map(|&i| &self.objects[i])
    }

    /// `tags.find((t) => t.name === name)`
    pub fn tag(&self, name: &str) -> Option<&Value> {
        self.tag_index
            .get_or_init(|| index(&self.tags))
            .get(name)
            .map(|&i| &self.tags[i])
    }
}
