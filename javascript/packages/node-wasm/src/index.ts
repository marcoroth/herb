export * from "@herb-tools/core"

import { HerbBackendNodeWASM } from "./wasm-backend.js"

import LibHerb from "../build/libherb.js"

/**
 * An instance of the `Herb` class using a Node.js WASM backend.
 * This loads `libherb` in Node.js using WebAssembly (WASM).
 */
const Herb = new HerbBackendNodeWASM(LibHerb)

export { Herb, HerbBackendNodeWASM }
