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

    /// The UTF-16 offset of the character boundary at byte `byte`. A byte past
    /// the end maps to the UTF-16 length plus the overflow, as TS emits
    /// `endNameOffset + endTagLength` past the end at `liquid-lines.ts:160`
    /// and `:168`. Per round 6 D7. A byte inside a char panics.
    pub fn utf16(&self, byte: usize) -> usize {
        let len = self.table.len() - 1;
        if byte > len {
            return self.table[len] as usize + (byte - len);
        }
        assert!(
            byte == 0 || self.table[byte] != self.table[byte - 1],
            "utf16: byte {byte} is inside a char"
        );
        self.table[byte] as usize
    }

    /// The byte offset of UTF-16 offset `utf16`, or `None` when it is past the
    /// end or inside a surrogate pair.
    pub fn byte(&self, utf16: usize) -> Option<usize> {
        let units = u32::try_from(utf16).ok()?;
        let byte = self.table.partition_point(|&entry| entry < units);
        (self.table.get(byte) == Some(&units)).then_some(byte)
    }
}

#[cfg(test)]
mod tests {
    use super::Utf16Offsets;

    #[test]
    #[should_panic(expected = "utf16: byte 2 is inside a char")]
    fn utf16_maps_past_end_and_boundaries_and_panics_mid_char() {
        let offsets = Utf16Offsets::new("a\u{e9}b");
        assert_eq!(offsets.utf16(4), 3);
        assert_eq!(offsets.utf16(6), 5);
        assert_eq!(offsets.utf16(3), 2);
        offsets.utf16(2);
    }
}
