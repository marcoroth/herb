import { readFileSync } from "node:fs"

import packageJSON from "../package.json" with { type: "json" }

import { HerbBackend, LexResult, ParseResult } from "@herb-tools/core"

import type { LexOptions } from "@herb-tools/core"

export class HerbBackendNode extends HerbBackend {
  lexFile(path: string, options?: LexOptions): LexResult {
    return this.lex(readFileSync(path, "utf-8"), options)
  }

  parseFile(path: string): ParseResult {
    return this.parse(readFileSync(path, "utf-8"))
  }

  backendVersion(): string {
    return `${packageJSON.name}@${packageJSON.version}`
  }
}
