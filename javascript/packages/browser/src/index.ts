export * from "@herb-tools/core"

import { HerbBackendWASM } from "./wasm-backend"

import LibHerb from "../build/libherb.js"

/**
 * An instance of the `Herb` class using a browser backend.
 * This loads `libherb` using WebAssembly (WASM).
 */
const Herb = new HerbBackendWASM(LibHerb)

export { Herb, HerbBackendWASM }
