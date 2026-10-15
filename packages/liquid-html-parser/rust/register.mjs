/**
 * Registers the Rust parser backend.
 *
 * Usage: `node --import <pkg>/rust/register.mjs`, or import it from a test
 * setup file. Requires `pnpm --dir packages/liquid-html-parser build:rust`.
 *
 * The `.wasm` is compiled synchronously from base64 bytes, so this works the
 * same in Node and in the browser and needs no fs or fetch. The public parse
 * functions are synchronous, so the module must be ready before the first
 * parse. The `.wasm` is under Chromium's 8 MiB main-thread limit for
 * synchronous compile, recorded in rust/pkg/size.json.
 */
import wasmBase64 from './pkg/bytes.mjs';
import { initSync, parse as wasmParse } from './pkg/liquid_html_parser.js';

const BACKEND_KEY = Symbol.for('@shopify/liquid-html-parser/backend');

initSync({ module: decodeBase64(wasmBase64) });

globalThis[BACKEND_KEY] = {
  parse(kind, source, allowUnclosedDocumentNode) {
    return wasmParse(kind, source, allowUnclosedDocumentNode);
  },
  stats: { parses: 0, fallbacks: { environment: 0, illFormed: 0 } },
};

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
