import { expect, describe, it } from 'vitest';
import { Reference } from '../types';
import { getAncestorUris, getAllSnippetDescendantUris, getRenderedSnippetUris } from './traversal';

function ref(
  sourceUri: string,
  targetUri: string,
  type: 'direct' | 'indirect' | 'preset' = 'direct',
): Reference {
  return { source: { uri: sourceUri }, target: { uri: targetUri }, type };
}

describe('getAncestorUris', () => {
  it('returns direct ancestors', async () => {
    const getReferences = async (uri: string) => {
      if (uri === 'file:///snippets/child.liquid') {
        return [ref('file:///sections/parent.liquid', 'file:///snippets/child.liquid')];
      }
      return [];
    };

    const ancestors = await getAncestorUris('file:///snippets/child.liquid', getReferences);
    expect(ancestors).toEqual(['file:///sections/parent.liquid']);
  });

  it('follows grandparent chain', async () => {
    const getReferences = async (uri: string) => {
      if (uri === 'file:///snippets/child.liquid') {
        return [ref('file:///sections/section.liquid', 'file:///snippets/child.liquid')];
      }
      if (uri === 'file:///sections/section.liquid') {
        return [ref('file:///layout/theme.liquid', 'file:///sections/section.liquid')];
      }
      return [];
    };

    const ancestors = await getAncestorUris('file:///snippets/child.liquid', getReferences);
    expect(ancestors).toEqual(['file:///sections/section.liquid', 'file:///layout/theme.liquid']);
  });

  it('ignores indirect references', async () => {
    const getReferences = async (uri: string) => {
      if (uri === 'file:///snippets/child.liquid') {
        return [
          ref('file:///sections/section.liquid', 'file:///snippets/child.liquid', 'indirect'),
        ];
      }
      return [];
    };

    const ancestors = await getAncestorUris('file:///snippets/child.liquid', getReferences);
    expect(ancestors).toEqual([]);
  });

  it('ignores preset references', async () => {
    const getReferences = async (uri: string) => {
      if (uri === 'file:///snippets/child.liquid') {
        return [ref('file:///sections/section.liquid', 'file:///snippets/child.liquid', 'preset')];
      }
      return [];
    };

    const ancestors = await getAncestorUris('file:///snippets/child.liquid', getReferences);
    expect(ancestors).toEqual([]);
  });

  it('handles cycles without infinite loop', async () => {
    const getReferences = async (uri: string) => {
      if (uri === 'file:///a.liquid') return [ref('file:///b.liquid', 'file:///a.liquid')];
      if (uri === 'file:///b.liquid') return [ref('file:///a.liquid', 'file:///b.liquid')];
      return [];
    };

    const ancestors = await getAncestorUris('file:///a.liquid', getReferences);
    expect(ancestors).toEqual(['file:///b.liquid']);
  });

  it('returns empty for file with no references', async () => {
    const ancestors = await getAncestorUris('file:///orphan.liquid', async () => []);
    expect(ancestors).toEqual([]);
  });
});

describe('getAllSnippetDescendantUris', () => {
  it('returns the initial snippets themselves', async () => {
    const result = await getAllSnippetDescendantUris(['file:///snippets/a.liquid'], async () => []);
    expect(result).toEqual(['file:///snippets/a.liquid']);
  });

  it('follows snippet dependencies recursively', async () => {
    const getDependencies = async (uri: string) => {
      if (uri === 'file:///snippets/a.liquid') {
        return [ref('file:///snippets/a.liquid', 'file:///snippets/b.liquid')];
      }
      if (uri === 'file:///snippets/b.liquid') {
        return [ref('file:///snippets/b.liquid', 'file:///snippets/c.liquid')];
      }
      return [];
    };

    const result = await getAllSnippetDescendantUris(
      ['file:///snippets/a.liquid'],
      getDependencies,
    );
    expect(result).toEqual([
      'file:///snippets/a.liquid',
      'file:///snippets/b.liquid',
      'file:///snippets/c.liquid',
    ]);
  });

  it('skips non-snippet dependencies', async () => {
    const getDependencies = async (uri: string) => {
      if (uri === 'file:///snippets/a.liquid') {
        return [
          ref('file:///snippets/a.liquid', 'file:///snippets/b.liquid'),
          ref('file:///snippets/a.liquid', 'file:///sections/not-a-snippet.liquid'),
        ];
      }
      return [];
    };

    const result = await getAllSnippetDescendantUris(
      ['file:///snippets/a.liquid'],
      getDependencies,
    );
    expect(result).toEqual(['file:///snippets/a.liquid', 'file:///snippets/b.liquid']);
  });

  it('skips indirect dependencies', async () => {
    const getDependencies = async (uri: string) => {
      if (uri === 'file:///snippets/a.liquid') {
        return [ref('file:///snippets/a.liquid', 'file:///snippets/b.liquid', 'indirect')];
      }
      return [];
    };

    const result = await getAllSnippetDescendantUris(
      ['file:///snippets/a.liquid'],
      getDependencies,
    );
    expect(result).toEqual(['file:///snippets/a.liquid']);
  });

  it('handles cycles without infinite loop', async () => {
    const getDependencies = async (uri: string) => {
      if (uri === 'file:///snippets/a.liquid') {
        return [ref('file:///snippets/a.liquid', 'file:///snippets/b.liquid')];
      }
      if (uri === 'file:///snippets/b.liquid') {
        return [ref('file:///snippets/b.liquid', 'file:///snippets/a.liquid')];
      }
      return [];
    };

    const result = await getAllSnippetDescendantUris(
      ['file:///snippets/a.liquid'],
      getDependencies,
    );
    expect(result).toEqual(['file:///snippets/a.liquid', 'file:///snippets/b.liquid']);
  });
});

describe('getRenderedSnippetUris', () => {
  it('returns direct snippet dependencies', async () => {
    const getDependencies = async () => [
      ref('file:///sections/section.liquid', 'file:///snippets/a.liquid'),
      ref('file:///sections/section.liquid', 'file:///snippets/b.liquid'),
    ];

    const result = await getRenderedSnippetUris('file:///sections/section.liquid', getDependencies);
    expect(result).toEqual(['file:///snippets/a.liquid', 'file:///snippets/b.liquid']);
  });

  it('excludes non-snippet dependencies', async () => {
    const getDependencies = async () => [
      ref('file:///sections/section.liquid', 'file:///snippets/a.liquid'),
      ref('file:///sections/section.liquid', 'file:///sections/other.liquid'),
    ];

    const result = await getRenderedSnippetUris('file:///sections/section.liquid', getDependencies);
    expect(result).toEqual(['file:///snippets/a.liquid']);
  });

  it('excludes indirect snippet dependencies', async () => {
    const getDependencies = async () => [
      ref('file:///sections/section.liquid', 'file:///snippets/a.liquid', 'indirect'),
    ];

    const result = await getRenderedSnippetUris('file:///sections/section.liquid', getDependencies);
    expect(result).toEqual([]);
  });

  it('returns empty when no dependencies', async () => {
    const result = await getRenderedSnippetUris('file:///sections/section.liquid', async () => []);
    expect(result).toEqual([]);
  });
});
