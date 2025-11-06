import { IdentityPrinter } from "@herb-tools/printer"
import { MinifyRewriter } from "./minifier-rewriter.js"

import type { HerbBackend, Node } from "@herb-tools/core"

/**
 * Minifier for HTML+ERB templates
 *
 * Removes non-significant whitespace while preserving:
 * - Whitespace in <pre> and <code> tags
 * - Document structure
 *
 * @example
 * ```typescript
 * import { Herb } from '@herb-tools/node-wasm'
 * import { Minifier } from '@herb-tools/minifier'
 * import dedent from 'dedent'
 *
 * const minifier = new Minifier(Herb)
 * await minifier.initialize()
 *
 * const template = dedent`
 *   <div class="container">
 *     <h1>Hello World</h1>
 *     <p>This is a test</p>
 *   </div>
 * `
 *
 * const minified = minifier.minifyString(template)
 * // Result: '<div class="container"><h1>Hello World</h1><p>This is a test</p></div>'
 * ```
 */
export class Minifier {
  private rewriter: MinifyRewriter
  private herb?: HerbBackend

  constructor(herb?: HerbBackend) {
    this.herb = herb
    this.rewriter = new MinifyRewriter()
  }

  /**
   * Initialize the minifier (loads Herb if needed)
   */
  async initialize(): Promise<void> {
    if (this.herb) {
      await this.herb.load()
    }
  }

  /**
   * Minify an HTML+ERB template string
   *
   * @param template - The template string to minify
   * @returns The minified template string
   */
  minifyString(template: string): string {
    if (!this.herb) {
      throw new Error("You need to pass a Herb Backend to new Minifier() and initialize the Minifier before calling minifyString()")
    }

    const parseResult = this.herb.parse(template, { track_whitespace: true })

    if (parseResult.failed) {
      return template
    }

    const node = this.rewriter.rewrite(parseResult.value)

    return IdentityPrinter.print(node)
  }

  /**
   * Minify an HTML+ERB AST node
   *
   * @param node - The AST node to minify
   * @returns The minified AST node
   */
  minify<T extends Node>(node: T): T {
    return this.rewriter.rewrite(node)
  }
}

export function minify<T extends Node>(node: T): { node: T, output: string } {
  const minifier = new Minifier()
  const minified = minifier.minify(node)

  return {
    node: minified,
    output: IdentityPrinter.print(minified)
  }
}
