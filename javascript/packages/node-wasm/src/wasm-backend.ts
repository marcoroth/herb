import { readFileSync } from "node:fs"

import { name, version } from "../package.json"

import { HerbBackend, LexResult, ParseResult } from "@herb-tools/core"

export class HerbBackendNodeWASM extends HerbBackend {
  lexFile(path: string): LexResult {
    return this.lex(readFileSync(path, "utf-8"))
  }

  parseFile(path: string): ParseResult {
    return this.parse(readFileSync(path, "utf-8"))
  }

  backendVersion(): string {
    return `${name}@${version}`
  }
}
