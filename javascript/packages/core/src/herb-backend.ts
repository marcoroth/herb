import packageJSON from "../package.json" with { type: "json" }

import { ensureString } from "./util.js"
import { LexResult } from "./lex-result.js"
import { BackendLintResult } from "./lint-result.js"
import { ParseResult } from "./parse-result.js"
import { DEFAULT_PARSER_OPTIONS } from "./parser-options.js"
import { DEFAULT_EXTRACT_RUBY_OPTIONS } from "./extract-ruby-options.js"
import { hasLinterBackend } from "./backend.js"
import { deserializePrismParseResult } from "./prism/index.js"

import type { LibHerbBackend, BackendPromise } from "./backend.js"
import type { ParseOptions } from "./parser-options.js"
import type { ExtractRubyOptions } from "./extract-ruby-options.js"
import type { PrismParseResult } from "./prism/index.js"
import type { DiffResult } from "./diff-result.js"

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
   */
  abstract lexFile(path: string): LexResult

  /**
   * Parses the given source string into a `ParseResult`.
   * @param source - The source code to parse.
   * @param options - Optional parsing options.
   * @returns A `ParseResult` instance.
   * @throws Error if the backend is not loaded.
   */
  parse(source: string, options?: ParseOptions): ParseResult {
    this.ensureBackend()

    const mergedOptions = { ...DEFAULT_PARSER_OPTIONS, ...options }

    return ParseResult.from(this.backend.parse(ensureString(source), mergedOptions))
  }

  /**
   * Parses a file.
   * @param path - The file path to parse.
   * @returns A `ParseResult` instance.
   */
  abstract parseFile(path: string): ParseResult

  /**
   * Extracts embedded Ruby code from the given source.
   * @param source - The source code to extract Ruby from.
   * @param options - Optional extraction options.
   * @returns The extracted Ruby code as a string.
   * @throws Error if the backend is not loaded.
   */
  extractRuby(source: string, options?: ExtractRubyOptions): string {
    this.ensureBackend()

    const mergedOptions = { ...DEFAULT_EXTRACT_RUBY_OPTIONS, ...options }

    return this.backend.extractRuby(ensureString(source), mergedOptions)
  }

  /**
   * Parses a Ruby source string using Prism via the libherb backend.
   * @param source - The Ruby source code to parse.
   * @returns A Prism ParseResult containing the AST.
   * @throws Error if the backend is not loaded.
   */
  parseRuby(source: string): PrismParseResult {
    this.ensureBackend()

    const bytes = this.backend.parseRuby(ensureString(source))

    if (!bytes) {
      throw new Error("Failed to parse Ruby source")
    }

    return deserializePrismParseResult(bytes, source)
  }

  /**
   * Diffs two source strings and returns the minimal set of AST differences.
   * @param oldSource - The old source code.
   * @param newSource - The new source code.
   * @returns A DiffResult containing the operations.
   * @throws Error if the backend is not loaded.
   */
  diff(oldSource: string, newSource: string): DiffResult {
    this.ensureBackend()

    return this.backend.diff(ensureString(oldSource), ensureString(newSource))
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
   * Checks if the backend supports the native linter (Rust-based).
   * @returns True if lint, lintRuleCount, and lintRuleNames are available.
   */
  get supportsLint(): boolean {
    return this.isLoaded && hasLinterBackend(this.backend)
  }

  /**
   * Lints the given source string using the native linter and returns a `BackendLintResult`.
   * @param source - The source code to lint.
   * @param configJson - Optional JSON string with linter configuration.
   * @param fileName - Optional file name for context.
   * @returns A `BackendLintResult` instance.
   * @throws Error if the backend is not loaded or does not support linting.
   */
  lint(source: string, configJson?: string, fileName?: string): BackendLintResult {
    this.ensureBackend()
    this.ensureLinterBackend()

    const backend = this.backend as LibHerbBackend & { lint: (source: string, configJson?: string, fileName?: string) => any }

    return BackendLintResult.from(backend.lint(ensureString(source), configJson, fileName))
  }

  /**
   * Returns the number of available native lint rules.
   * @returns The count of lint rules.
   * @throws Error if the backend is not loaded or does not support linting.
   */
  lintRuleCount(): number {
    this.ensureBackend()
    this.ensureLinterBackend()

    const backend = this.backend as LibHerbBackend & { lintRuleCount: () => number }

    return backend.lintRuleCount()
  }

  /**
   * Returns the names of all available native lint rules.
   * @returns An array of lint rule name strings.
   * @throws Error if the backend is not loaded or does not support linting.
   */
  lintRuleNames(): string[] {
    this.ensureBackend()
    this.ensureLinterBackend()

    const backend = this.backend as LibHerbBackend & { lintRuleNames: () => string[] }

    return backend.lintRuleNames()
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
   * Ensures that the backend supports linting.
   * @throws Error if the backend does not support linting.
   */
  ensureLinterBackend(): void {
    if (!this.supportsLint) {
      throw new Error(
        "Herb backend does not support native linting. Use the @herb-tools/linter package for JavaScript-based linting, or use a backend that includes the Rust linter.",
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
