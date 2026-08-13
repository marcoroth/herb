/**
 * `TextEncoder` is a WHATWG global that both browsers and Node provide, but its
 * only bundled typing lives in `lib.dom`. Declaring the one member used here
 * keeps the DOM out of this package, so browser-only APIs stay compile errors.
 */
declare class TextEncoder {
  encode(input?: string): Uint8Array
}
