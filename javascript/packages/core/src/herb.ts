import { ensureString } from "./util.js"

import { isLibHerbBackend } from "./backend.js"

import packageJSON from "../package.json" with { type: "json" }

import type { LibHerbBackend } from "./backend.js"
import type { LexResult } from "./lex-result.js"
import type { ParseResult } from "./parse-result.js"

export class Herb {
  readonly backend: LibHerbBackend

  constructor(backend: LibHerbBackend) {
    if (!backend) {
      throw new Error("No LibHerb backend provided")
    }

    if (isLibHerbBackend(backend)) {
      this.backend = backend
    } else {
      throw new Error("Coudn't load LibHerb backend")
    }
  }

  lex(source: string): LexResult {
    return this.backend.lex(ensureString(source))
  }

  async lexFile(path: string): Promise<LexResult> {
    return this.backend.lexFile(ensureString(path))
  }

  lexToJson(source: string): object {
    return JSON.parse(this.backend.lexToJson(ensureString(source)))
  }

  parse(source: string): ParseResult {
    return this.backend.parse(ensureString(source))
  }

  async parseFile(path: string): Promise<ParseResult> {
    return this.backend.parseFile(ensureString(path))
  }

  extractRuby(source: string): string {
    return this.backend.extractRuby(ensureString(source))
  }

  extractHtml(source: string): string {
    return this.backend.extractHtml(ensureString(source))
  }

  get version(): string {
    const backend = this.backend.backend()
    const core = `${packageJSON.name}@${packageJSON.version}`
    const libherb = this.backend.version()

    return `${backend}, ${core}, ${libherb}`
  }
}
