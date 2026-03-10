import packageJSON from "../package.json" with { type: "json" }

import { ensureString } from "./util.js"
import { LexResult } from "./lex-result.js"
import { ParseResult } from "./parse-result.js"
import { DEFAULT_PARSER_OPTIONS } from "./parser-options.js"

import type { LibHerbBackend, BackendPromise } from "./backend.js"
import type { ParserOptions } from "./parser-options.js"

/**
 * The main Herb parser interface, providing methods to lex and parse input.
 */
export abstract class HerbBackend {
  /** The backend instance handling lexing and parsing. */
  public backend: LibHerbBackend | undefined = undefined
  public readonly backendPromise: BackendPromise

  /**
   * Creates a new Herb instance.
   * @param backendPromise - A promise resolving to a `LibHerbBackend` implementation for lexing and parsing.
   * @throws Error if no valid backend is provided.
   */
  constructor(backendPromise: BackendPromise) {
    if (!backendPromise) {
      throw new Error("No LibHerb backend provided")
    }

    this.backendPromise = backendPromise
  }

  /**
   * Loads the backend by resolving the backend promise.
   * @returns A promise containing the resolved `HerbBackend` instance after loading it.
   */
  async load(): Promise<HerbBackend> {
    const backend = await this.backendPromise()
    this.backend = backend
    return this
  }

  /**
   * Lexes the given source string into a `LexResult`.
   * @param source - The source code to lex.
   * @returns A `LexResult` instance.
   * @throws Error if the backend is not loaded.
   */
  lex(source: string): LexResult {
    this.ensureBackend()

    return LexResult.from(this.backend.lex(ensureString(source)))
  }

  /**
   * Lexes a file.
   * @param path - The file path to lex.
   * @returns A `LexResult` instance.
   * @throws Error if the backend is not loaded.
   */
  lexFile(path: string): LexResult {
    this.ensureBackend()

    return LexResult.from(this.backend.lexFile(ensureString(path)))
  }

  /**
   * Parses the given source string into a `ParseResult`.
   * @param source - The source code to parse.
   * @param options - Optional parsing options.
   * @returns A `ParseResult` instance.
   * @throws Error if the backend is not loaded.
   */
  parse(source: string, options?: ParserOptions): ParseResult {
    this.ensureBackend()

    const mergedOptions = { ...DEFAULT_PARSER_OPTIONS, ...options }

    return ParseResult.from(this.backend.parse(ensureString(source), mergedOptions))
  }

  /**
   * Parses a file.
   * @param path - The file path to parse.
   * @returns A `ParseResult` instance.
   * @throws Error if the backend is not loaded.
   */
  parseFile(path: string): ParseResult {
    this.ensureBackend()

    return ParseResult.from(this.backend.parseFile(ensureString(path)))
  }

  /**
   * Extracts embedded Ruby code from the given source.
   * @param source - The source code to extract Ruby from.
   * @returns The extracted Ruby code as a string.
   * @throws Error if the backend is not loaded.
   */
  extractRuby(source: string): string {
    this.ensureBackend()

    return this.backend.extractRuby(ensureString(source))
  }

  /**
   * Extracts HTML from the given source.
   * @param source - The source code to extract HTML from.
   * @returns The extracted HTML as a string.
   * @throws Error if the backend is not loaded.
   */
  extractHTML(source: string): string {
    this.ensureBackend()

    return this.backend.extractHTML(ensureString(source))
  }

  /**
   * Gets the Herb version information, including the core and backend versions.
   * @returns A version string containing backend, core, and libherb versions.
   * @throws Error if the backend is not loaded.
   */
  get version(): string {
    this.ensureBackend()

    const backend = this.backendVersion()
    const core = `${packageJSON.name}@${packageJSON.version}`
    const libherb = this.backend.version()

    return `${backend}, ${core}, ${libherb}`
  }

  /**
   * Ensures that the backend is loaded.
   * @throws Error if the backend is not loaded.
   */
  ensureBackend(): asserts this is { backend: LibHerbBackend } {
    if (!this.isLoaded) {
      throw new Error(
        "Herb backend is not loaded. Call `await Herb.load()` first.",
      )
    }
  }

  /**
   * Checks if the backend is loaded.
   * @returns True if the backend is loaded, false otherwise.
   */
  get isLoaded() {
    return this.backend !== undefined
  }

  /**
   * Abstract method to get the backend version.
   * @returns A string representing the backend version.
   */
  abstract backendVersion(): string
}
