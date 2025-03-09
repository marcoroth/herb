import { name, version } from "../package.json"
import libHerbBinary from "./wasm.js"

import type { LibHerbBackend } from "@herb-tools/core"

const backend: LibHerbBackend = {
  lex: (source: string) => {
    return libHerbBinary.lex(source)
  },

  lexFile: (_path: string) => {
    throw new Error("File system operations are not supported in the browser.")
  },

  lexToJson: (source: string) => {
    return libHerbBinary.lexToJson(source)
  },

  parse: (source: string) => {
    return libHerbBinary.parse(source)
  },

  parseFile: (_path: string) => {
    throw new Error("File system operations are not supported in the browser.")
  },

  extractRuby: (source: string) => {
    return libHerbBinary.extractRuby(source)
  },

  extractHtml: (source: string) => {
    return libHerbBinary.extractHtml(source)
  },

  version: () => {
    return libHerbBinary.version()
  },

  backend: () => {
    return `${name}@${version}`
  },
}

export { backend }
