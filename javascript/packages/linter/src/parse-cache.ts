import { DEFAULT_PARSER_OPTIONS, ParseResult } from "@herb-tools/core"
import { cloneNode } from "@herb-tools/rewriter"
import { DEFAULT_LINTER_PARSER_OPTIONS } from "./types.js"

import type { HerbBackend, ParserOptions } from "@herb-tools/core"

/**
 * How many parse results to keep around. A single source takes 16 entries,
 * one per distinct set of rule parser options, and a lint is usually followed
 * by an autofix and by a lint of the fixed source, so this holds that cycle
 * plus a spare.
 */
export const MAX_ENTRIES = 48

export class ParseCache {
  private herb: HerbBackend
  private cache = new Map<string, ParseResult>()

  constructor(herb: HerbBackend) {
    this.herb = herb
  }

  /**
   * The cached parse result, which callers must treat as read-only.
   */
  get(source: string, parserOptions: Partial<ParserOptions> = {}): ParseResult {
    const effectiveOptions = this.resolveOptions(parserOptions)
    const key = source + JSON.stringify(effectiveOptions)

    const cached = this.cache.get(key)

    if (cached) {
      this.cache.delete(key)
      this.cache.set(key, cached)

      return cached
    }

    const result = this.herb.parse(source, effectiveOptions)

    this.cache.set(key, result)
    this.evict()

    return result
  }

  /**
   * A copy for callers that rewrite the tree, such as autofix. Mutating what
   * `get()` returns would serve the rewritten tree to every later lint of the
   * same source.
   */
  getMutable(source: string, parserOptions: Partial<ParserOptions> = {}): ParseResult {
    const cached = this.get(source, parserOptions)

    return new ParseResult(
      cloneNode(cached.value),
      cached.source,
      [...cached.warnings],
      [...cached.errors],
      cached.options
    )
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

  private evict(): void {
    while (this.cache.size > MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value

      if (oldest === undefined) return

      this.cache.delete(oldest)
    }
  }
}
