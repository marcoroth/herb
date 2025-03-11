import type {
  SerializedLexResult,
  SerializedParseResult,
} from "@herb-tools/core";

// @ts-ignore
import * as herbWasmModule from '../../build/libherb.wasm';

console.log(herbWasmModule)

// Import the WASI shim with its types
import { WASI } from '@bjorn3/browser_wasi_shim';
// Import the parsePrism function
import { parsePrism } from '@ruby/prism/src/parsePrism.js';

// Define types for the WebAssembly instance exports
interface PrismExports extends WebAssembly.Exports {
  // Add the specific exports that prism provides
  _pm_buffer_free: Function;
  _pm_buffer_init: Function;
  _pm_node_destroy: Function;
  _pm_node_type_to_str: Function;
  _pm_parse: Function;
  _pm_parser_free: Function;
  _pm_parser_init: Function;
  _pm_prettyprint: Function;
  _pm_visit_child_nodes: Function;
  _pm_visit_node: Function;
  // Add memory if needed, may need appropriate type
  memory: WebAssembly.Memory;
}

// Load and initialize prism WASM
async function loadPrism() {
  try {
    // Fetch and compile the WASM module
    const wasmResponse = await fetch(new URL('@ruby/prism/src/prism.wasm', import.meta.url));
    const wasmBuffer = await wasmResponse.arrayBuffer();
    const wasm = await WebAssembly.compile(wasmBuffer);

    // Initialize WASI
    const wasi = new WASI([], [], []);
    const instance = await WebAssembly.instantiate(wasm, {
      wasi_snapshot_preview1: wasi.wasiImport
    });

    // TypeScript fix: Use type assertion for initialize
    (wasi as any).initialize(instance);

    // Create the parse function
    const parse = (source: string) => parsePrism(instance.exports as any, source);

    return {
      parse,
      exports: instance.exports as unknown as PrismExports
    };
  } catch (error) {
    console.error("Failed to load Prism WASM:", error);
    throw error;
  }
}

// Load and initialize herb WASM
// async function loadHerb(prismExports: PrismExports) {
// async function loadHerb() {
//   try {
//     // Import herb module
//     const herbModule = await import('../build/libherb.js');
//
//     // Debug what herbModule contains
//     console.log("Herb module contents:", herbModule);
//     console.log("Herb module keys:", Object.keys(herbModule));
//
//     // Check if it has a default export
//     if (typeof herbModule.default !== 'function') {
//       console.error("herbModule.default is not a function!");
//
//       // Try to find the correct way to initialize it
//       // @ts-ignore
//       if (herbModule.libherb) {
//         console.log("Found libherb property, trying that instead");
//         // @ts-ignore
//         const herb = await herbModule.libherb();
//         return herb;
//       }
//     }
//
//     // Initialize herb with prism exports
//     const herb = await herbModule.default({
//       // Map prism's exports to what herb expects
//       // pm_buffer_free: prismExports._pm_buffer_free,
//       // pm_buffer_init: prismExports._pm_buffer_init,
//       // pm_node_destroy: prismExports._pm_node_destroy,
//       // pm_node_type_to_str: prismExports._pm_node_type_to_str,
//       // pm_parse: prismExports._pm_parse,
//       // pm_parser_free: prismExports._pm_parser_free,
//       // pm_parser_init: prismExports._pm_parser_init,
//       // pm_prettyprint: prismExports._pm_prettyprint,
//       // pm_visit_child_nodes: prismExports._pm_visit_child_nodes,
//       // pm_visit_node: prismExports._pm_visit_node
//     });
//
//     return herb;
//   } catch (error) {
//     console.error("Failed to load Herb WASM:", error);
//     throw error;
//   }
// }

async function loadHerb() {
  try {
    // Use fetch to get the WASM file
    const wasmResponse = await fetch('../../build/libherb.wasm');
    const wasmBuffer = await wasmResponse.arrayBuffer();
    const wasmModule = await WebAssembly.compile(wasmBuffer);

    // Then instantiate it with the imports
    const instance = await WebAssembly.instantiate(wasmModule, {
      env: {
        // Add your imports here
        // pm_buffer_free: prismExports._pm_buffer_free,
        // ... other imports
      },
      wasi_snapshot_preview1: {
        // WASI imports if needed
      }
    });

    return instance.exports;
  } catch (error) {
    console.error("Failed to load Herb WASM:", error);
    throw error;
  }
}


// Load both WASM modules
async function loadLibs() {
  try {
    // First load prism
    // const prism = await loadPrism();

    // Then load herb with prism's exports
    // const herb = await loadHerb(prism.exports);
    const herb = await loadHerb();

    return herb;
  } catch (error) {
    console.error("Failed to load WebAssembly modules:", error);
    throw error;
  }
}

// Initialize the WASM modules when this module is imported
const libherbPromise = loadLibs();

class WASMBinary {
  static async getLib() {
    return await libherbPromise;
  }

  static async lex(source: string) {
    try {
      const lib = await this.getLib();
      return lib.cwrap("herb_lex", "string", ["string"])(source);
    } catch (error) {
      console.error("Error calling herb_lex:", error);
      throw error;
    }
  }

  static async lexToJson(source: string) {
    try {
      const lib = await this.getLib();
      return lib.cwrap("herb_lex_json", "string", ["string"])(source);
    } catch (error) {
      console.error("Error calling herb_lex_json:", error);
      throw error;
    }
  }

  static async parse(source: string) {
    try {
      const lib = await this.getLib();
      return lib.cwrap("herb_parse", "string", ["string"])(source);
    } catch (error) {
      console.error("Error calling herb_parse:", error);
      throw error;
    }
  }

  static async extractRuby(source: string) {
    try {
      const lib = await this.getLib();
      return lib.cwrap("herb_extract_ruby", "string", ["string"])(source);
    } catch (error) {
      console.error("Error calling herb_extract_ruby:", error);
      throw error;
    }
  }

  static async extractHtml(source: string) {
    try {
      const lib = await this.getLib();
      return lib.cwrap("herb_extract_html", "string", ["string"])(source);
    } catch (error) {
      console.warn("extractHtml not implemented in WASM:", error);
      return "";
    }
  }

  static async version() {
    try {
      const lib = await this.getLib();
      return lib.cwrap("herb_version", "string", [])();
    } catch (error) {
      console.error("Error calling herb_version:", error);
      throw error;
    }
  }
}

export default WASMBinary;
