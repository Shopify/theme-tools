/*
 * Strict serializer for parser output, used to prove two parser backends
 * produce the same result. It returns a string so equality is `===`.
 *
 * Unlike `toEqual` or `JSON.stringify`, it keeps everything a consumer of the
 * AST can observe: own key order, keys whose value is `undefined`, the
 * prototype of every object, aliasing (one object reachable by two paths is
 * written as a back-reference to the first path), whether `source` and
 * `_source` are the parse input, and the observable fields of thrown errors.
 * `error.stack` is the only thing left out.
 */

const SOURCE_KEYS = new Set(['source', '_source']);

type Seen = Map<object, string>;

export function canonical(value: unknown, input: string): string {
  return encode(value, '$', input, new Map(), undefined);
}

function encode(
  value: unknown,
  path: string,
  input: string,
  seen: Seen,
  key: string | undefined,
): string {
  if (typeof value === 'string') return encodeString(value, input, key);
  if (typeof value === 'number') return encodeNumber(value);
  if (value === undefined) return '{"$undefined":true}';
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'bigint') return `{"$bigint":${JSON.stringify(value.toString())}}`;
  if (typeof value === 'symbol') return `{"$symbol":${JSON.stringify(value.toString())}}`;
  if (typeof value === 'function') return `{"$function":${JSON.stringify(value.name)}}`;
  return encodeObject(value as object, path, input, seen);
}

function encodeString(value: string, input: string, key: string | undefined): string {
  if (key === undefined || !SOURCE_KEYS.has(key)) return JSON.stringify(value);
  if (value === input) return '{"$source":"input"}';
  return `{"$source":"other","value":${JSON.stringify(value)}}`;
}

function encodeNumber(value: number): string {
  if (Object.is(value, -0)) return '{"$number":"-0"}';
  if (!Number.isFinite(value)) return `{"$number":${JSON.stringify(String(value))}}`;
  return JSON.stringify(value);
}

function encodeObject(value: object, path: string, input: string, seen: Seen): string {
  const firstPath = seen.get(value);
  if (firstPath !== undefined) return `{"$ref":${JSON.stringify(firstPath)}}`;
  seen.set(value, path);

  if (value instanceof Error) return encodeError(value, path, input, seen);
  if (Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype) {
    return encodeArray(value, path, input, seen);
  }
  return `{"$proto":${JSON.stringify(protoName(value))},"props":${encodeProps(
    value,
    ownKeys(value),
    path,
    input,
    seen,
  )}}`;
}

function encodeArray(value: unknown[], path: string, input: string, seen: Seen): string {
  const items: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const item =
      i in value ? encode(value[i], `${path}[${i}]`, input, seen, undefined) : '{"$hole":true}';
    items.push(item);
  }
  const extraKeys = ownKeys(value).filter((key) => !isArrayIndexOrLength(key, value.length));
  if (extraKeys.length === 0) return `[${items.join(',')}]`;
  return `{"$array":[${items.join(',')}],"props":${encodeProps(value, extraKeys, path, input, seen)}}`;
}

/*
 * `name` is usually inherited from the prototype, so it is read explicitly.
 * Own keys keep their order, minus `stack`, which differs run to run.
 */
function encodeError(value: Error, path: string, input: string, seen: Seen): string {
  const keys = ownKeys(value).filter((key) => key !== 'stack');
  return `{"$error":${JSON.stringify(value.constructor?.name ?? null)},"name":${JSON.stringify(
    String(value.name),
  )},"message":${JSON.stringify(String(value.message))},"props":${encodeProps(
    value,
    keys,
    path,
    input,
    seen,
  )}}`;
}

function encodeProps(
  value: object,
  keys: (string | symbol)[],
  path: string,
  input: string,
  seen: Seen,
): string {
  const entries = keys.map((key) => encodeProp(value, key, path, input, seen));
  return `[${entries.join(',')}]`;
}

function encodeProp(
  value: object,
  key: string | symbol,
  path: string,
  input: string,
  seen: Seen,
): string {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
  const keyText =
    typeof key === 'symbol' ? `{"$symbol":${JSON.stringify(key.toString())}}` : JSON.stringify(key);
  const childPath = `${path}.${typeof key === 'symbol' ? key.toString() : JSON.stringify(key)}`;
  const flags = descriptor.enumerable ? '' : ',"enumerable":false';
  const stringKey = typeof key === 'string' ? key : undefined;
  if ('value' in descriptor) {
    return `[${keyText},${encode(descriptor.value, childPath, input, seen, stringKey)}${flags}]`;
  }
  const got = descriptor.get ? descriptor.get.call(value) : undefined;
  return `[${keyText},{"$accessor":${encode(got, childPath, input, seen, stringKey)}}${flags}]`;
}

function ownKeys(value: object): (string | symbol)[] {
  return Reflect.ownKeys(value);
}

function isArrayIndexOrLength(key: string | symbol, length: number): boolean {
  if (key === 'length') return true;
  if (typeof key !== 'string') return false;
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < length && String(index) === key;
}

function protoName(value: object): string {
  const proto = Object.getPrototypeOf(value);
  if (proto === null) return 'null';
  if (proto === Object.prototype) return 'Object';
  const name = proto.constructor?.name;
  return typeof name === 'string' && name !== '' ? `class:${name}` : 'class:<anonymous>';
}
