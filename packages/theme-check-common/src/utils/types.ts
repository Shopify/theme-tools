/**
 * ArgumentTypes extracts the type of the arguments of a function.
 *
 * @example
 *
 * function doStuff(a: number, b: string) {
 *   // do stuff
 * }
 *
 * type DoStuffArgs = ArgumentTypes<typeof doStuff> // = [number, string].
 */
export type ArgumentTypes<F extends Function> = F extends (...args: infer T) => void ? T : never;

/**
 * WithOptional<T, K> turns the properties K of type T optional.
 *
 * @example
 *
 * interface Dependencies {
 *   log(msg: string): void;
 *   loadConfig(uri: string): Config;
 * }
 *
 * function check({
 *  log = defaultLogger,
 *  loadConfig,
 * }: WithOptional<Dependencies, 'log'>) {
 *   // log can be undefined and we'll use the default value.
 *   // but loadConfig is not optional
 * }
 */
export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * WithRequired<T, K> turns the optional properties K in keyof T as required.
 */
export type WithRequired<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

/**
 * assertNever(x: never);
 *
 * You use this in the default case of switch statements to make sure you
 * exhaust your discriminated union.
 *
 * If you don't, typescript is going to complain that assertNever is being
 * called with a non-never value.
 *
 * @example
 * switch (fruit.type) {
 *   case BANANA: // ...
 *   case APPLE: // ...
 *   default: return assertNever(fruit.type);
 * }
 */
export function assertNever(x: never): never {
  throw new Error(`We should never reach this code, you are missing a case for ${x}`);
}
