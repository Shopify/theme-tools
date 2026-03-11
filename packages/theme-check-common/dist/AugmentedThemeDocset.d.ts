import { FilterEntry, ObjectEntry, TagEntry, ThemeDocset, Translations } from './types';
export declare class AugmentedThemeDocset implements ThemeDocset {
    private themeDocset;
    constructor(themeDocset: ThemeDocset);
    isAugmented: boolean;
    private objectsByPrefix;
    setObjectsForURI(uri: string, objects: ObjectEntry[]): void;
    getObjectsForURI(uri: string): ObjectEntry[] | undefined;
    filters: import("./utils").MemoedFunction<() => Promise<FilterEntry[]>>;
    objects: import("./utils").MemoedFunction<() => Promise<ObjectEntry[]>>;
    liquidDrops: import("./utils").MemoedFunction<() => Promise<ObjectEntry[]>>;
    tags: import("./utils").MemoedFunction<() => Promise<TagEntry[]>>;
    systemTranslations: import("./utils").MemoedFunction<() => Promise<Translations>>;
}
