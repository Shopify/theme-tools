//! Byte offset to UTF-16 offset table.
//!
//! Rust strings index UTF-8 bytes, and JS string offsets count UTF-16 code
//! units. The parser works in byte offsets and converts every offset it emits
//! through one table built per parse, so a non-ASCII character cannot shift a
//! later position.

pub struct Utf16Offsets {
    table: Vec<u32>,
}

impl Utf16Offsets {
    /// Builds the table for `source`. Entry `i` is the UTF-16 offset of byte
    /// `i`, and the entry at `source.len()` is the UTF-16 length.
    pub fn new(source: &str) -> Self {
        let mut table = Vec::with_capacity(source.len() + 1);
        let mut units = 0u32;
        for c in source.chars() {
            table.extend(std::iter::repeat_n(units, c.len_utf8()));
            units += c.len_utf16() as u32;
        }
        table.push(units);
        Self { table }
    }

    /// The UTF-16 offset of the character boundary at byte `byte`.
    pub fn utf16(&self, byte: usize) -> usize {
        self.table[byte] as usize
    }
}
