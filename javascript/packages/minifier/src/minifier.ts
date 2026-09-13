import { MinifyPrinter } from "./minify-printer.js"

import type { HerbBackend, Node } from "@herb-tools/core"

/**
 * Minifier for HTML+ERB templates
 *
 * Removes the whitespace that does not survive rendering and the comments that
 * carry no markup, while preserving:
 * - the content of whitespace preserving elements
 * - downlevel-revealed conditional comments
 * - Herb directives
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
  private herb?: HerbBackend

  constructor(herb?: HerbBackend) {
    this.herb = herb
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

    return MinifyPrinter.print(parseResult.value)
  }

  /**
   * Minify an HTML+ERB AST node
   *
   * @param node - The AST node to minify
   * @returns The minified template string
   */
  minify(node: Node): string {
    return MinifyPrinter.print(node)
  }
}

export function minify(node: Node): string {
  return MinifyPrinter.print(node)
}
