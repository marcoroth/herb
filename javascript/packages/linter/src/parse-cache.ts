import { DEFAULT_PARSER_OPTIONS } from "@herb-tools/core"
import { DEFAULT_LINTER_PARSER_OPTIONS } from "./types.js"

import type { ParseResult, HerbBackend, ParserOptions } from "@herb-tools/core"

const ADDITIVE_PARSER_OPTIONS = ["prism_nodes", "prism_program"] as const

type AdditiveParserOption = typeof ADDITIVE_PARSER_OPTIONS[number]

export class ParseCache {
  private herb: HerbBackend
  private baseOptions: Partial<ParserOptions>
  private cache = new Map<string, ParseResult>()

  constructor(herb: HerbBackend, baseOptions: Partial<ParserOptions> = {}) {
    this.herb = herb
    this.baseOptions = baseOptions
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

  /**
   * Widens each set of parser options so that sets which only differ in
   * `prism_nodes` and `prism_program` resolve to the same options and share one parse.
   *
   * Both options only attach serialized Prism nodes to the tree the other options
   * produce, so a rule that did not ask for them parses the same tree with them on.
   *
   * @param parserOptionsList - The parser options each rule asks for
   * @returns The widened parser options, in the same order
   */
  share(parserOptionsList: Partial<ParserOptions>[]): ParserOptions[] {
    const resolved = parserOptionsList.map(parserOptions => this.resolveOptions(parserOptions))
    const additiveByShape = new Map<string, Set<AdditiveParserOption>>()

    for (const parserOptions of resolved) {
      const shape = this.shapeKey(parserOptions)
      const additive = additiveByShape.get(shape) ?? new Set<AdditiveParserOption>()

      for (const name of ADDITIVE_PARSER_OPTIONS) {
        if (parserOptions[name]) additive.add(name)
      }

      additiveByShape.set(shape, additive)
    }

    return resolved.map(parserOptions => {
      const additive = additiveByShape.get(this.shapeKey(parserOptions)) ?? new Set<AdditiveParserOption>()

      return { ...parserOptions, ...Object.fromEntries([...additive].map(name => [name, true])) }
    })
  }

  resolveOptions(parserOptions: Partial<ParserOptions>): ParserOptions {
    return {
      ...DEFAULT_PARSER_OPTIONS,
      ...DEFAULT_LINTER_PARSER_OPTIONS,
      ...this.baseOptions,
      ...parserOptions
    }
  }

  private shapeKey(parserOptions: ParserOptions): string {
    const shape: Record<string, unknown> = { ...parserOptions }

    for (const name of ADDITIVE_PARSER_OPTIONS) {
      delete shape[name]
    }

    return JSON.stringify(shape)
  }
}
