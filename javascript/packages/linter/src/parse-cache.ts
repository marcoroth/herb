import { DEFAULT_PARSER_OPTIONS } from "@herb-tools/core"
import { DEFAULT_LINTER_PARSER_OPTIONS } from "./types.js"

import type { ParseResult, HerbBackend, ParserOptions } from "@herb-tools/core"

export class ParseCache {
  private herb: HerbBackend
  private cache = new Map<string, ParseResult>()

  constructor(herb: HerbBackend) {
    this.herb = herb
  }

  get(source: string, parserOptions: Partial<ParserOptions> = {}): ParseResult {
    const effectiveOptions = this.resolveOptions(parserOptions)
    const key = source + JSON.stringify(effectiveOptions)

    let result = this.cache.get(key)

    if (!result) {
      result = this.herb.parse(source, effectiveOptions)
      this.cache.set(key, result)
    }

    return result
  }

  clear(): void {
    this.cache.clear()
  }

  resolveOptions(parserOptions: Partial<ParserOptions>): ParserOptions {
    return {
      ...DEFAULT_PARSER_OPTIONS,
      ...DEFAULT_LINTER_PARSER_OPTIONS,
      ...parserOptions
    }
  }
}
