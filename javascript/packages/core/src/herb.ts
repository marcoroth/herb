import { ensureString } from "./util.js"
import { isLibHerbBackend } from "./backend.js"
import packageJSON from "../package.json" with { type: "json" }

import type { LibHerbBackend } from "./backend.js"
import { LexResult } from "./lex-result.js"
import { ParseResult } from "./parse-result.js"

/**
 * The main Herb parser interface, providing methods to lex and parse input.
 */
export class Herb {
  /** The backend instance handling lexing and parsing. */
  readonly backend: LibHerbBackend

  /**
   * Creates a new Herb instance.
   * @param backend - The backend implementation for lexing and parsing.
   * @throws Error if no valid backend is provided.
   */
  constructor(backend: LibHerbBackend) {
    if (!backend) {
      throw new Error("No LibHerb backend provided")
    }

    if (isLibHerbBackend(backend)) {
      this.backend = backend
    } else {
      throw new Error("Couldn't load LibHerb backend")
    }
  }

  /**
   * Lexes the given source string into a `LexResult`.
   * @param source - The source code to lex.
   * @returns A `LexResult` instance.
   */
  async lex(source: string): Promise<LexResult> {
    return LexResult.from(await this.backend.lex(ensureString(source)))
  }

  /**
   * Lexes a file asynchronously.
   * @param path - The file path to lex.
   * @returns A promise resolving to a `LexResult` instance.
   */
  async lexFile(path: string): Promise<LexResult> {
    return LexResult.from(await this.backend.lexFile(ensureString(path)))
  }

  /**
   * Lexes the given source and returns the result as a JSON object.
   * @param source - The source code to lex.
   * @returns A parsed JSON object representing the lex result.
   */
  async lexToJson(source: string): Promise<object> {
    return JSON.parse(await this.backend.lexToJson(ensureString(source)))
  }

  /**
   * Parses the given source string into a `ParseResult`.
   * @param source - The source code to parse.
   * @returns A `ParseResult` instance.
   */
  async parse(source: string): Promise<ParseResult> {
    return ParseResult.from(await this.backend.parse(ensureString(source)))
  }

  /**
   * Parses a file asynchronously.
   * @param path - The file path to parse.
   * @returns A promise resolving to a `ParseResult` instance.
   */
  async parseFile(path: string): Promise<ParseResult> {
    return ParseResult.from(await this.backend.parseFile(ensureString(path)))
  }

  /**
   * Extracts embedded Ruby code from the given source.
   * @param source - The source code to extract Ruby from.
   * @returns The extracted Ruby code as a string.
   */
  async extractRuby(source: string): Promise<string> {
    return await this.backend.extractRuby(ensureString(source))
  }

  /**
   * Extracts HTML from the given source.
   * @param source - The source code to extract HTML from.
   * @returns The extracted HTML as a string.
   */
  async extractHtml(source: string): Promise<string> {
    return await this.backend.extractHtml(ensureString(source))
  }

  /**
   * Gets the Herb version information, including the core and backend versions.
   * @returns A version string containing backend, core, and libherb versions.
   */
  async version(): Promise<string> {
    const backend = this.backend.backend()
    const core = `${packageJSON.name}@${packageJSON.version}`
    const libherb = await this.backend.version()

    return `${backend}, ${core}, ${libherb}`
  }
}
