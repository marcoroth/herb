import packageJSON from "../package.json" with { type: "json" }

import type { LibHerbBackend } from "@herb-tools/core"

export function createBackend(libHerbBinary: any): LibHerbBackend {
  return {
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

    version: (): string => {
      return libHerbBinary.version()
    },

    backend: (): string => {
      return `${packageJSON.name}@${packageJSON.version}`
    },
  }
}
