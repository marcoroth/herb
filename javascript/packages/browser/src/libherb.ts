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
    return module.lex(source)
  },

  async lexFile(_path: string): Promise<SerializedLexResult> {
    throw new Error("File system operations are not supported in the browser.")
  },

  async lexToJson(_source: string): Promise<string> {
    throw new Error("not supported in the browser.")
  },

  async parse(source: string): Promise<SerializedParseResult> {
    const module = await modulePromise
    return module.parse(source)
  },

  async parseFile(_path: string): Promise<SerializedParseResult> {
    throw new Error("File system operations are not supported in the browser.")
  },

  async extractRuby(source: string): Promise<string> {
    const module = await modulePromise
    return module.extractRuby(source)
  },

  async extractHtml(source: string): Promise<string> {
    const module = await modulePromise
    return module.extractHTML(source)
  },

  async version(): Promise<string> {
    const module = await modulePromise

    return module.version()
  },

  backend(): string {
    return `${name}@${version}`
  },
}

export { backend }
