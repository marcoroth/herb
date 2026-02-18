import type { SerializedParseResult } from "./parse-result.js"
import type { SerializedLexResult } from "./lex-result.js"
<<<<<<< HEAD
import type { LexOptions, ParseOptions } from "./parser-options.js"
import type { BackendArenaOption } from "./arena.js"
||||||| parent of fac81712b (Improve JavaScript API and also support arena in lex)
import type { ParserOptions } from "./parser-options.js"
=======
>>>>>>> fac81712b (Improve JavaScript API and also support arena in lex)
import type { ExtractRubyOptions } from "./extract-ruby-options.js"
import type { DiffOptions, DiffResult } from "./diff-result.js"

interface LibHerbBackendFunctions {
<<<<<<< HEAD
  lex: (source: string, options?: LexOptions & BackendArenaOption) => SerializedLexResult
||||||| parent of fac81712b (Improve JavaScript API and also support arena in lex)
  lex: (source: string) => SerializedLexResult
  lexFile: (path: string) => SerializedLexResult
=======
  lex: (source: string, options?: Record<string, unknown>) => SerializedLexResult
  lexFile: (path: string, options?: Record<string, unknown>) => SerializedLexResult
>>>>>>> fac81712b (Improve JavaScript API and also support arena in lex)

<<<<<<< HEAD
  parse: (source: string, options?: ParseOptions & BackendArenaOption) => SerializedParseResult

  diff: (oldSource: string, newSource: string, options?: DiffOptions) => DiffResult
||||||| parent of fac81712b (Improve JavaScript API and also support arena in lex)
  parse: (source: string, options?: ParserOptions) => SerializedParseResult
  parseFile: (path: string) => SerializedParseResult
=======
  parse: (source: string, options?: Record<string, unknown>) => SerializedParseResult
  parseFile: (path: string, options?: Record<string, unknown>) => SerializedParseResult
>>>>>>> fac81712b (Improve JavaScript API and also support arena in lex)

  extractRuby: (source: string, options?: ExtractRubyOptions) => string
  extractHTML: (source: string) => string

  parseRuby: (source: string) => Uint8Array | null

  defaultERBOpenings: () => string[]

  version: () => string
}

export type BackendPromise = () => Promise<LibHerbBackend>

const expectedFunctions = [
  "parse",
  "lex",
  "diff",
  "extractRuby",
  "extractHTML",
  "parseRuby",
  "defaultERBOpenings",
  "version",
] as const

type LibHerbBackendFunctionName = (typeof expectedFunctions)[number]

type CheckFunctionsExistInInterface =
  LibHerbBackendFunctionName extends keyof LibHerbBackendFunctions
    ? true
    : "Error: Not all expectedFunctions are defined in LibHerbBackendFunctions"

type CheckInterfaceKeysInFunctions =
  keyof LibHerbBackendFunctions extends LibHerbBackendFunctionName
    ? true
    : "Error: LibHerbBackendFunctions has keys not listed in expectedFunctions"

// NOTE: This function should never be called and is only for type checking
// so we can make sure `expectedFunctions` matches the functions defined
// in `LibHerbBackendFunctions` and the other way around.
//
export function _TYPECHECK() {
  const checkFunctionsExist: CheckFunctionsExistInInterface = true
  const checkInterfaceComplete: CheckInterfaceKeysInFunctions = true

  return { checkFunctionsExist, checkInterfaceComplete }
}

// Exported Types + Functions

export type LibHerbBackend = {
  [K in LibHerbBackendFunctionName]: LibHerbBackendFunctions[K]
}

export function isLibHerbBackend(
  object: any,
  libherbpath: string = "unknown",
): object is LibHerbBackend {
  for (const expectedFunction of expectedFunctions) {
    if (object[expectedFunction] === undefined) {
      throw new Error(
        `Libherb at "${libherbpath}" doesn't expose function "${expectedFunction}".`,
      )
    }

    if (typeof object[expectedFunction] !== "function") {
      throw new Error(
        `Libherb at "${libherbpath}" has "${expectedFunction}" but it's not a function.`,
      )
    }
  }

  return true
}

export function ensureLibHerbBackend(
  object: any,
  libherbpath: string = "unknown",
): LibHerbBackend {
  isLibHerbBackend(object, libherbpath)
  return object
}
