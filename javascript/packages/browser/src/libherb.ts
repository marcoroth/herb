import { name, version } from "../package.json"
import LibHerb from "../build/libherb.js"

import type {
  LibHerbBackend,
  SerializedLexResult,
  SerializedParseResult,
} from "@herb-tools/core"

const backend: LibHerbBackend = {
  async lex(source: string): Promise<SerializedLexResult> {
    const libherb = await LibHerb()
    return libherb.lex(source)
  },

  async lexFile(_path: string): Promise<SerializedLexResult> {
    throw new Error("File system operations are not supported in the browser.")
  },

  async lexToJson(_source: string): Promise<string> {
    throw new Error("not supported in the browser.")
  },

  async parse(source: string): Promise<SerializedParseResult> {
    const libherb = await LibHerb()
    return libherb.parse(source)
  },

  async parseFile(_path: string): Promise<SerializedParseResult> {
    throw new Error("File system operations are not supported in the browser.")
  },

  async extractRuby(source: string): Promise<string> {
    const libherb = await LibHerb()
    return libherb.extractRuby(source)
  },

  async extractHtml(source: string): Promise<string> {
    const libherb = await LibHerb()
    return libherb.extractHTML(source)
  },

  async version(): Promise<string> {
    const libherb = await LibHerb()

    return libherb.version()
  },

  backend(): string {
    return `${name}@${version}`
  },
}

export { backend }
