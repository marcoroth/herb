import type { SerializedParseResult } from "./parse-result.js"
import type { SerializedLexResult } from "./lex-result.js"

interface LibHerbBackendFunctions {
  lex: (source: string) => Promise<SerializedLexResult>
  lexFile: (path: string) => Promise<SerializedLexResult>
  lexToJson: (source: string) => Promise<string>

  parse: (source: string) => Promise<SerializedParseResult>
  parseFile: (path: string) => Promise<SerializedParseResult>

  extractRuby: (source: string) => Promise<string>
  extractHtml: (source: string) => Promise<string>

  version: () => Promise<string>
  backend: () => string
}

const expectedFunctions = [
  "parse",
  "lex",
  "parseFile",
  "lexFile",
  "lexToJson",
  "extractRuby",
  "extractHtml",
  "version",
  "backend",
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
