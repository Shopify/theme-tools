import { describe, it } from 'vitest';
import { TextEditor } from 'vscode';
import { code, codeMetadata } from './base';
import { expect } from 'vitest';

describe('code', () => {
  it('returns code with line numbers when no selection', () => {
    const mockEditor = {
      selection: {
        isEmpty: true,
        start: { line: 0 },
      },
      document: {
        getText: () => 'line1\nline2',
      },
    } as unknown as TextEditor;

    const result = code(mockEditor);
    expect(result).toBe(`
<code>
1: line1
2: line2
</code>`);
  });

  it('returns selected code with offset line numbers', () => {
    const mockEditor = {
      selection: {
        isEmpty: false,
        start: { line: 5 },
      },
      document: {
        getText: () => 'selected1\nselected2',
      },
    } as unknown as TextEditor;

    const result = code(mockEditor);
    expect(result).toBe(`
<code>
6: selected1
7: selected2
</code>`);
  });
});

describe('codeMetadata', () => {
  it('returns metadata for theme file', () => {
    const mockEditor = {
      document: {
        fileName: 'sections/test.liquid',
      },
    } as unknown as TextEditor;

    const result = codeMetadata(mockEditor);

    expect(result).toBe(`
<code_metadata>
  - name: sections/test.liquid,
  - type: sections,
  - context: [
      - As sections grow in complexity, consider extracting reusable parts into snippets for better maintainability
      - Also look for opportunities to make components more flexible by moving hardcoded values into section settings that merchants can customize
    ]
</code_metadata>`);
  });

  it('returns metadata for non-theme file', () => {
    const mockEditor = {
      document: {
        fileName: 'random.liquid',
      },
    } as unknown as TextEditor;

    const result = codeMetadata(mockEditor);

    expect(result).toBe(`
<code_metadata>
  - name: random.liquid,
  - type: none,
  - context: [
      this is a regular Liquid file
    ]
</code_metadata>`);
  });
});
