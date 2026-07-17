// Re-export all tag definition types so existing imports from './environment' keep working.
export {
  TagKind,
  type BranchName,
  type Parser,
  type TagDefinition,
  type TagDefinitionBlock,
  type TagDefinitionHybrid,
  type TagDefinitionRaw,
  type TagDefinitionTag,
  type LiquidLine,
  type LiquidLineContext,
} from './tag-definitions';

import type { TagDefinition } from './tag-definitions';
import { builtinTags } from './tags/index';

export class Environment {
  private builtins: Record<string, TagDefinition>;
  private custom: Map<string, TagDefinition>;
  private static _default: Environment | undefined;

  constructor(builtins: Record<string, TagDefinition> = {}) {
    this.builtins = builtins;
    this.custom = new Map();
  }

  tagForName(name: string): TagDefinition | undefined {
    return this.custom.get(name) ?? this.builtins[name];
  }

  registerTag(name: string, definition: TagDefinition): void {
    this.custom.set(name, definition);
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
