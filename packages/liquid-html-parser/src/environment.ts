// Re-export all tag definition types so existing imports from './environment' keep working.
export {
  TagKind,
  isStructuralEndTag,
  type BranchName,
  type Parser,
  type TagDefinition,
  type TagDefinitionBlock,
  type TagDefinitionRaw,
  type TagDefinitionTag,
  type LiquidLine,
  type LiquidLineContext,
} from './tag-definitions';

import { TagKind, type TagDefinition } from './tag-definitions';
import { builtinTags } from './tags/index';

export class Environment {
  private builtins: Map<string, TagDefinition>;
  private custom: Map<string, TagDefinition>;
  private registryVersion = 0;
  private rawTagStates?: Map<string, string>;
  private static _default: Environment | undefined;

  constructor(builtins: Record<string, TagDefinition> = {}) {
    // A Map so tag names like `constructor` don't resolve to Object.prototype members.
    this.builtins = new Map(Object.entries(builtins));
    this.custom = new Map();
  }

  tagForName(name: string): TagDefinition | undefined {
    return this.custom.get(name) ?? this.builtins.get(name);
  }

  registerTag(name: string, definition: TagDefinition): void {
    // Definitions and opaque-tag lists can be changed in place before registration.
    const rawState =
      definition.kind === TagKind.Raw
        ? JSON.stringify([
            Boolean(definition.parseLiquidInBody),
            definition.body.delimiter,
            definition.body.sameName,
            definition.body.closesInLiquidTag,
            definition.body.opaque,
          ])
        : undefined;
    if (this.custom.get(name) === definition && this.rawTagStates?.get(name) === rawState) return;
    this.custom.set(name, definition);
    if (rawState !== undefined) (this.rawTagStates ??= new Map()).set(name, rawState);
    else this.rawTagStates?.delete(name);
    this.registryVersion++;
  }

  get tagRegistryVersion(): number {
    return this.registryVersion;
  }

  /** Custom parsers and resolvers can change the registry while parsing. */
  usesBuiltinTags(): boolean {
    return (
      this === Environment._default &&
      this.custom.size === 0 &&
      this.tagForName === Environment.prototype.tagForName
    );
  }

  static default(): Environment {
    if (!Environment._default) {
      Environment._default = new Environment(builtinTags);
    }
    return Environment._default;
  }

  /** Reset singleton — for testing only */
  static resetDefault(): void {
    Environment._default = undefined;
  }
}
