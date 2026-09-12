import { readFileSync } from "node:fs"

import { name, version } from "../package.json"

import { HerbBackend, LexResult, ParseResult } from "@herb-tools/core"

import type { LexOptions } from "@herb-tools/core"

export class HerbBackendNodeWASM extends HerbBackend {
  lexFile(path: string, options?: LexOptions): LexResult {
    return this.lex(readFileSync(path, "utf-8"), options)
  }

  parseFile(path: string): ParseResult {
    return this.parse(readFileSync(path, "utf-8"))
  }

  backendVersion(): string {
    return `${name}@${version}`
  }
}
