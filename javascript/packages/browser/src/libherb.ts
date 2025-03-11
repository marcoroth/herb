import { name, version } from "../package.json"
import libHerbBinary from "./wasm.js"
import type { LibHerbBackend } from "@herb-tools/core"

const backend: LibHerbBackend = {
  lex: (source: string) => {
    return libHerbBinary.lex(source) as any
  },
  lexFile: (_path: string) => {
    throw new Error("File system operations are not supported in the browser.")
  },
  lexToJson: (source: string) => {
    return libHerbBinary.lexToJson(source) as any
  },
  parse: (source: string) => {
    return libHerbBinary.parse(source) as any
  },
  parseFile: (_path: string) => {
    throw new Error("File system operations are not supported in the browser.")
  },
  extractRuby: (source: string) => {
    return libHerbBinary.extractRuby(source) as any
  },
  extractHtml: (source: string) => {
    return libHerbBinary.extractHtml(source) as any
  },
  version: () => {
    return libHerbBinary.version() as any
  },
  backend: () => {
    return `${name}@${version}`
  },
}

// @ts-ignore
window.backend = backend

export { backend }
