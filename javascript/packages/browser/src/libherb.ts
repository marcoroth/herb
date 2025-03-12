import { name, version } from "../package.json"
import libHerbInit from "../build/libherb.js"
import type {
  LibHerbBackend,
  SerializedLexResult,
  SerializedParseResult,
} from "@herb-tools/core"

const modulePromise = libHerbInit()

const backend: LibHerbBackend = {
  async lex(source: string): Promise<SerializedLexResult> {
    const module = await modulePromise
    const lexFunc = module.cwrap("herb_lex", "string", ["string"])
    const resultJson = lexFunc(source)
    return JSON.parse(resultJson) as SerializedLexResult
  },

  async lexFile(_path: string): Promise<SerializedLexResult> {
    throw new Error("File system operations are not supported in the browser.")
  },

  async lexToJson(source: string): Promise<string> {
    const module = await modulePromise
    const lexToJsonFunc = module.cwrap("herb_lex_to_json", "string", ["string"])
    return lexToJsonFunc(source)
  },

  async parse(source: string): Promise<SerializedParseResult> {
    const module = await modulePromise
    const parseFunc = module.cwrap("herb_parse", "string", ["string"])
    const resultJson = parseFunc(source)
    return JSON.parse(resultJson) as SerializedParseResult
  },

  async parseFile(_path: string): Promise<SerializedParseResult> {
    throw new Error("File system operations are not supported in the browser.")
  },

  async extractRuby(source: string): Promise<string> {
    const module = await modulePromise
    const extractRubyFunc = module.cwrap("herb_extract_ruby", "string", [
      "string",
    ])
    return extractRubyFunc(source)
  },

  async extractHtml(source: string): Promise<string> {
    const module = await modulePromise
    const extractHtmlFunc = module.cwrap("herb_extract_html", "string", [
      "string",
    ])
    return extractHtmlFunc(source)
  },

  async version(): Promise<string> {
    const module = await modulePromise

    const versionPointer = module._herb_version()
    const versionString = module.UTF8ToString(versionPointer)

    return `libherb@${versionString} (WebAssembly)`
  },

  backend(): string {
    return `${name}@${version}`
  },
}

// @ts-ignore
window.backend = backend

export { backend }
