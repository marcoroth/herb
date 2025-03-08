import { ensureString } from "./util.js"

import type { LibHerbBackend } from "../lib/backend.js"
import type { LexResult } from "../lib/lex-result.js"
import type { ParseResult } from "../lib/parse-result.js"

export class Herb {
  readonly backend: LibHerbBackend

  constructor(backend: LibHerbBackend) {
    this.backend = backend
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
    const libherbVersion = this.backend.version()

    return `v${"TODO"} (via libherb v${libherbVersion})`
  }
}
