import { Node, Visitor, Token, ParseResult, isToken, isParseResult } from "@herb-tools/core"
import { PrintContext } from "./print-context.js"

import type { ERBNode } from "@herb-tools/core"

/**
 * Options for controlling the printing behavior
 */
export type PrintOptions = {
  /**
   * When true, allows printing nodes that have parse errors.
   * When false (default), throws an error if attempting to print nodes with errors.
   * @default false
   */
  ignoreErrors: boolean
}

/**
 * Default print options used when none are provided
 */
export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  ignoreErrors: false
}

export abstract class Printer extends Visitor {
  protected context: PrintContext = new PrintContext()

  /**
   * Static method to print a node without creating an instance
   *
   * @param input - The AST Node, Token, or ParseResult to print
   * @param options - Print options to control behavior
   * @returns The printed string representation of the input
   * @throws {Error} When node has parse errors and ignoreErrors is false
   */
  static print(input: Token | Node | ParseResult | Node[] | undefined | null, options: PrintOptions = DEFAULT_PRINT_OPTIONS): string {
    const printer = new (this as any)()

    return printer.print(input, options)
  }

  /**
   * Print a node, token, or parse result to a string
   *
   * @param input - The AST Node, Token, or ParseResult to print
   * @param options - Print options to control behavior
   * @returns The printed string representation of the input
   * @throws {Error} When node has parse errors and ignoreErrors is false
   */
  print(input: Token | Node | ParseResult | Node[] | undefined | null, options: PrintOptions = DEFAULT_PRINT_OPTIONS): string {
    if (!input) return ""

    if (isToken(input)) {
      return input.value
    }

    if (Array.isArray(input)) {
      this.context.reset()
      input.forEach(node => this.visit(node))
      return this.context.getOutput()
    }

    const node: Node = isParseResult(input) ? input.value : input

    if (options.ignoreErrors === false && node.recursiveErrors().length > 0) {
      throw new Error(`Cannot print the node (${node.type}) since it or any of its children has parse errors. Either pass in a valid Node or call \`print()\` using \`print(node, { ignoreErrors: true })\``)
    }

    this.context.reset()

    this.visit(node)

    return this.context.getOutput()
  }

  protected write(content: string): void {
    this.context.write(content)
  }
}
