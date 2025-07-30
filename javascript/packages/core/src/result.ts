import { HerbError } from "./errors.js"
import { HerbWarning } from "./warning.js"

export abstract class Result {
  readonly source: string
  readonly warnings: HerbWarning[]
  readonly errors: HerbError[]

  constructor(
    source: string,
    warnings: HerbWarning[] = [],
    errors: HerbError[] = [],
  ) {
    this.source = source
    this.warnings = warnings || []
    this.errors = errors || []
  }

  /**
   * Determines if the parsing was successful.
   * @returns `true` if there are no errors, otherwise `false`.
   */
  get successful(): boolean {
    return this.errors.length === 0
  }

  /**
   * Determines if the parsing failed.
   * @returns `true` if there are errors, otherwise `false`.
   */
  get failed(): boolean {
    return this.errors.length > 0
  }
}
