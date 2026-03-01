import type { RewriteContext } from "./context.js"

/**
 * Base class for string rewriters that transform the formatted output
 *
 * String rewriters receive the formatted string and can modify it before
 * returning the final output. They run after the formatting step.
 *
 * @example
 * ```typescript
 * import { StringRewriter } from "@herb-tools/rewriter"
 *
 * class AddTrailingNewline extends StringRewriter {
 *   get name() { return "add-trailing-newline" }
 *   get description() { return "Ensures file ends with a newline" }
 *
 *   rewrite(formatted, context) {
 *     return formatted.endsWith("\n") ? formatted : formatted + "\n"
 *   }
 * }
 * ```
 */
export abstract class StringRewriter {
  /**
   * Unique identifier for this rewriter
   * Used in configuration and error messages
   */
  abstract get name(): string

  /**
   * Human-readable description of what this rewriter does
   */
  abstract get description(): string

  /**
   * Optional async initialization hook
   *
   * Called once before the first rewrite operation. Use this to:
   * - Load configuration files
   * - Initialize dependencies
   * - Perform expensive setup operations
   *
   * @param context - Context with baseDir and optional filePath
   */
  async initialize(_context: RewriteContext): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Transform the formatted string
   *
   * This method is called synchronously for each file being formatted.
   * Return the modified string.
   *
   * @param formatted - The formatted string output from the formatter
   * @param context - Context with filePath and baseDir
   * @returns The modified string
   */
  abstract rewrite(formatted: string, context: RewriteContext): string
}
