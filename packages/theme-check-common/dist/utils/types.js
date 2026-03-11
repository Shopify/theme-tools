"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertNever = assertNever;
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
function assertNever(x) {
    throw new Error(`We should never reach this code, you are missing a case for ${x}`);
}
//# sourceMappingURL=types.js.map