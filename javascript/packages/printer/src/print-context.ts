import type { PrinterOptions } from "./types.js"

export class PrintContext {
  private output: string = ""
  private indentLevel: number = 0
  private currentColumn: number = 0
  private preserveStack: string[] = []
  private options: PrinterOptions

  constructor(options: PrinterOptions = {}) {
    this.options = options
  }

  /**
   * Write text to the output
   */
  write(text: string): void {
    this.output += text
    this.currentColumn += text.length
  }

  /**
   * Write text and update column tracking for newlines
   */
  writeWithColumnTracking(text: string): void {
    this.output += text
    const lines = text.split('\n')
    if (lines.length > 1) {
      this.currentColumn = lines[lines.length - 1].length
    } else {
      this.currentColumn += text.length
    }
  }

  /**
   * Insert a newline and reset column tracking
   */
  newline(): void {
    this.write(this.options.lineEnding || '\n')
    this.currentColumn = 0
  }

  /**
   * Insert a newline followed by current indentation
   */
  newlineWithIndent(): void {
    this.newline()
    this.writeIndent()
  }

  /**
   * Write current indentation
   */
  writeIndent(): void {
    const indentChar = this.options.indentChar || ' '
    const indentSize = this.options.indentSize || 2
    const indentText = indentChar.repeat(this.indentLevel * indentSize)
    this.write(indentText)
  }

  /**
   * Increase indentation level
   */
  indent(): void {
    this.indentLevel++
  }

  /**
   * Decrease indentation level
   */
  dedent(): void {
    if (this.indentLevel > 0) {
      this.indentLevel--
    }
  }

  /**
   * Enter a tag that may preserve whitespace
   */
  enterTag(tagName: string): void {
    this.preserveStack.push(tagName.toLowerCase())
  }

  /**
   * Exit the current tag
   */
  exitTag(): void {
    this.preserveStack.pop()
  }

  /**
   * Check if we're currently in a whitespace-preserving context
   */
  shouldPreserveWhitespace(): boolean {
    const preserveTags = this.options.preserveWhitespace || []
    return this.preserveStack.some(tag => preserveTags.includes(tag))
  }

  /**
   * Check if we're at the start of a line
   */
  isAtStartOfLine(): boolean {
    return this.currentColumn === 0
  }

  /**
   * Check if adding text would exceed max line length
   */
  wouldExceedLineLength(additionalLength: number): boolean {
    const maxLength = this.options.maxLineLength
    return maxLength ? (this.currentColumn + additionalLength) > maxLength : false
  }

  /**
   * Get current indentation level
   */
  getCurrentIndentLevel(): number {
    return this.indentLevel
  }

  /**
   * Get current column position
   */
  getCurrentColumn(): number {
    return this.currentColumn
  }

  /**
   * Get the current tag stack (for debugging)
   */
  getTagStack(): string[] {
    return [...this.preserveStack]
  }

  /**
   * Get the complete output string
   */
  getOutput(): string {
    return this.output
  }

  /**
   * Reset the context for reuse
   */
  reset(): void {
    this.output = ""
    this.indentLevel = 0
    this.currentColumn = 0
    this.preserveStack = []
  }
}
