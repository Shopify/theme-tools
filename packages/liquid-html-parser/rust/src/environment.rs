//! Port of `Environment.tagForName` from `src/environment.ts`, for the builtin
//! environment, the only one the backend runs with.
//!
//! TS reads `this.builtins[name]` from a plain object, so a name that
//! `Object.prototype` holds finds an inherited value instead of `undefined`.

use crate::js::js_object_prototype_has;
use crate::tag_definitions::TagDefinition;
use crate::tags::index::builtin_tag;

/// The result of TS `env.tagForName(name)`.
pub enum TagLookup {
    /// An own key of `builtinTags`.
    Builtin(&'static TagDefinition),
    /// A value inherited from `Object.prototype`, such as the `Object`
    /// function for `constructor`. It is truthy and has no `kind`.
    ProtoKey,
    /// `undefined`.
    Missing,
}

/// TS `env.tagForName(name)`: the builtin table first, then the prototype
/// chain, as a plain-object index looks them up.
pub fn tag_for_name(name: &str) -> TagLookup {
    if let Some(definition) = builtin_tag(name) {
        return TagLookup::Builtin(definition);
    }
    if js_object_prototype_has(name) {
        return TagLookup::ProtoKey;
    }
    TagLookup::Missing
}
