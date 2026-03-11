"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaProp = void 0;
class SchemaProp {
    constructor(options) {
        this.options = options;
    }
    /** Creates a string setting definition */
    static string(defaultValue) {
        return new SchemaProp({ type: 'string', defaultValue });
    }
    /** Creates a number setting definition */
    static number(defaultValue) {
        return new SchemaProp({ type: 'number', defaultValue });
    }
    /** Creates a boolean setting definition */
    static boolean(defaultValue) {
        return new SchemaProp({ type: 'boolean', defaultValue });
    }
    /**
     * Creates an object setting definition
     *
     * Usage:
     * ```
     * const schema = {
     *   user: SchemaProp.object({
     *     age: SchemaProp.number(),
     *     name: SchemaProp.string(),
     *   })
     * };
     * ```
     *
     * @returns a schema property definition for an object type
     */
    static object(
    /** The schema of the object's properties */
    properties, defaultValue) {
        const schema = new SchemaProp({ type: 'object', defaultValue, properties });
        return schema;
    }
    /**
     * Creates an array setting definition
     *
     * Usage:
     * ```
     * const schema = {
     *   numbers: SchemaProp.array(SchemaProp.number(), [0, 1]),
     *   strings: SchemaProp.array(SchemaProp.string(), ["foo", "bar"]),
     *   users: SchemaProp.array(SchemaProp.object({
     *    name: SchemaProp.string(),
     *    age: SchemaProp.number(),
     *   })),
     * };
     * ```
     *
     * @param itemType the type of the items in the array
     * @returns a schema property definition for an object type
     */
    static array(
    /** The schema prop type of the items in the array */
    itemType, defaultValue) {
        const schema = new SchemaProp({ type: 'array', defaultValue, itemType });
        return schema;
    }
    /**
     * A schema prop can be optional, making the setting T | undefined.
     *
     * Usage:
     * ```
     * const Schema = {
     *   age: SchemaProp.number().optional(),
     * }
     * ```
     */
    optional() {
        this.options.optional = true;
        return this;
    }
    defaultValue() {
        return this.options.defaultValue;
    }
}
exports.SchemaProp = SchemaProp;
//# sourceMappingURL=schema-prop-factory.js.map