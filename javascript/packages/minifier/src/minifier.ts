import { Node, ParseResult } from "@herb-tools/core"
import { MinifyingPrinter, MinifyingPrinterOptions } from "./minifying-printer.js"
import { MinifierOptions, DEFAULT_MINIFIER_OPTIONS } from "./minifier-visitor.js"

export interface MinifyResult {
  output: string
  originalSize: number
  minifiedSize: number
  reduction: number
  reductionPercentage: number
}

export class Minifier {
  private options: MinifierOptions

  constructor(options: MinifierOptions = {}) {
    this.options = { ...DEFAULT_MINIFIER_OPTIONS, ...options }
  }

  minify(input: ParseResult | Node): MinifyResult {
    let node: Node
    let originalInput: string

    // Handle different input types
    if ('value' in input && 'errors' in input) {
      // ParseResult
      if (!input.value) {
        throw new Error("ParseResult contains no value")
      }
      node = input.value
      const printer = new MinifyingPrinter()
      originalInput = printer.print(input.value)
    } else {
      // Node
      node = input
      const printer = new MinifyingPrinter()
      originalInput = printer.print(node)
    }

    // Create minifying printer with configured options
    const printerOptions: Partial<MinifyingPrinterOptions> = {
      collapseWhitespace: this.options.collapseWhitespace,
      collapseMultipleSpaces: this.options.collapseMultipleSpaces,
      collapseMultipleNewlines: this.options.collapseMultipleNewlines,
      preserveLineBreaks: this.options.preserveLineBreaks,
      preserveWhitespace: this.options.preserveTags,
      trimTextNodes: this.options.trimTextNodes
    }
    const printer = new MinifyingPrinter(printerOptions)

    // Generate minified output
    const output = printer.print(node)

    const originalSize = originalInput.length
    const minifiedSize = output.length
    const reduction = originalSize - minifiedSize
    const reductionPercentage = originalSize > 0
      ? Math.round((reduction / originalSize) * 100 * 100) / 100
      : 0

    return {
      output,
      originalSize,
      minifiedSize,
      reduction,
      reductionPercentage
    }
  }

}
