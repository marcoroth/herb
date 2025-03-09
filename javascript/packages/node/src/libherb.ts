import binary from "@mapbox/node-pre-gyp"

import packageJSON from "../package.json" with { type: "json" }
import { resolvePath } from "./util.js"

import type { LibHerbBackend } from "@herb-tools/core"

const libherbPath = binary.find("./package.json")
const libHerbBinary = require(resolvePath(`../${libherbPath}`))

const backend: LibHerbBackend = {
  lex: (source: string) => {
    return libHerbBinary.lex(source)
  },

  lexFile: (path: string) => {
    return libHerbBinary.lexFile(path)
  },

  lexToJson: (source: string) => {
    return libHerbBinary.lex(source)
  },

  parse: (source: string) => {
    return libHerbBinary.parse(source)
  },

  parseFile: (path: string) => {
    return libHerbBinary.parseFile(path)
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
    return `${packageJSON.name}@${packageJSON.version}`
  },
}

export { backend }
