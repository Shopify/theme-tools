import { describe, expect, it, beforeEach } from 'vitest';
import {
  Environment,
  TagKind,
  type TagDefinition,
  type TagDefinitionBlock,
  type TagDefinitionTag,
  type TagDefinitionRaw,
  type TagDefinitionHybrid,
} from './environment';
import { assertNever } from './utils';

const stubParse = () => undefined;

function makeBlockDef(branches: ('elsif' | 'else' | 'when')[] = []): TagDefinitionBlock {
  return { kind: TagKind.Block, parse: stubParse, branches };
}

function makeStandaloneDef(): TagDefinitionTag {
  return { kind: TagKind.Tag, parse: stubParse };
}

function makeRawDef(parseLiquidInBody?: boolean): TagDefinitionRaw {
  return { kind: TagKind.Raw, parse: stubParse, parseLiquidInBody };
}

function makeHybridDef(): TagDefinitionHybrid {
  return { kind: TagKind.Hybrid, parse: stubParse };
}

describe('Unit: Environment', () => {
  beforeEach(() => {
    Environment.resetDefault();
  });

  describe('default()', () => {
    it('returns the same instance on multiple calls (singleton)', () => {
      const a = Environment.default();
      const b = Environment.default();
      expect(a).toBe(b);
    });

    it('returns a new instance after resetDefault()', () => {
      const a = Environment.default();
      Environment.resetDefault();
      const b = Environment.default();
      expect(a).not.toBe(b);
    });
  });

  describe('tagForName()', () => {
    it('returns undefined for unknown tag names', () => {
      const env = new Environment();
      expect(env.tagForName('nonexistent')).toBeUndefined();
    });

    it('returns the builtin definition when constructed with builtins', () => {
      const ifDef = makeBlockDef(['elsif', 'else']);
      const env = new Environment({ if: ifDef });
      expect(env.tagForName('if')).toBe(ifDef);
    });
  });

  describe('registerTag()', () => {
    it('registered tag is returned by tagForName', () => {
      const env = new Environment();
      const customDef = makeStandaloneDef();
      env.registerTag('my_tag', customDef);
      expect(env.tagForName('my_tag')).toBe(customDef);
    });

    it('custom tags override builtins with same name', () => {
      const builtinDef = makeBlockDef();
      const customDef = makeStandaloneDef();
      const env = new Environment({ capture: builtinDef });
      expect(env.tagForName('capture')).toBe(builtinDef);
      env.registerTag('capture', customDef);
      expect(env.tagForName('capture')).toBe(customDef);
    });
  });

  describe('TagKind enum', () => {
    it('has expected string values', () => {
      expect(TagKind.Block).toBe('block');
      expect(TagKind.Tag).toBe('tag');
      expect(TagKind.Raw).toBe('raw');
      expect(TagKind.Hybrid).toBe('hybrid');
    });
  });

  describe('TagDefinition discriminated union', () => {
    it('works with switch + assertNever exhaustiveness pattern', () => {
      function describeKind(def: TagDefinition): string {
        switch (def.kind) {
          case TagKind.Block:
            return `block(branches=${def.branches.join(',')})`;
          case TagKind.Tag:
            return 'tag';
          case TagKind.Raw:
            return `raw(parseLiquid=${def.parseLiquidInBody ?? false})`;
          case TagKind.Hybrid:
            return 'hybrid';
          default:
            return assertNever(def);
        }
      }

      expect(describeKind(makeBlockDef(['elsif', 'else']))).toBe('block(branches=elsif,else)');
      expect(describeKind(makeStandaloneDef())).toBe('tag');
      expect(describeKind(makeRawDef(true))).toBe('raw(parseLiquid=true)');
      expect(describeKind(makeRawDef())).toBe('raw(parseLiquid=false)');
      expect(describeKind(makeHybridDef())).toBe('hybrid');
    });
  });
});
