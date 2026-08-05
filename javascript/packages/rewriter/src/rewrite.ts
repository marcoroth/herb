import { IdentityPrinter } from "@herb-tools/printer"

import { ASTRewriter } from "./ast-rewriter.js"
import { StringRewriter } from "./string-rewriter.js"

import type { HerbBackend, Node } from "@herb-tools/core"
import type { RewriteContext } from "./context.js"

export type Rewriter = ASTRewriter | StringRewriter

export interface RewriteOptions {
  /**
   * Base directory for resolving configuration files
   * Defaults to process.cwd()
   */
  baseDir?: string

  /**
   * Optional file path for context
   */
  filePath?: string
}

export interface RewriteResult {
  /**
   * The rewritten template string
   */
  output: string

  /**
   * The rewritten AST node
   */
  node: Node
}

/**
 * Rewrite an AST Node using the provided rewriters
 *
 * This is the main rewrite function that operates on AST nodes.
 * For string input, use `rewriteString()` instead.
 *
 * @example
 * ```typescript
 * import { Herb } from '@herb-tools/node-wasm'
 * import { rewrite } from '@herb-tools/rewriter'
 * import { tailwindClassSorter } from '@herb-tools/rewriter/loader'
 *
 * await Herb.load()
 *
 * const template = '<div class="text-red-500 p-4 mt-2"></div>'
 * const parseResult = Herb.parse(template)
 * const { output, node } = rewrite(parseResult.value, [tailwindClassSorter()])
 * ```
 *
 * @param node - The AST Node to rewrite
 * @param rewriters - Array of rewriter instances to apply
 * @param options - Optional configuration for the rewrite operation
 * @returns Object containing the rewritten string and Node
 */
export function rewrite<T extends Node>(node: T, rewriters: Rewriter[], options: RewriteOptions = {}): RewriteResult & { node: T } {
  const { baseDir = process.cwd(), filePath } = options

  const context: RewriteContext = { baseDir, filePath }

  let currentNode = node

  const astRewriters = rewriters.filter(rewriter => rewriter instanceof ASTRewriter)
  const stringRewriters = rewriters.filter(rewriter => rewriter instanceof StringRewriter)

  for (const rewriter of astRewriters) {
    try {
      currentNode = rewriter.rewrite(currentNode, context)
    } catch (error) {
      console.error(`AST rewriter "${rewriter.name}" failed:`, error)
    }
  }

  let result = IdentityPrinter.print(currentNode)

  for (const rewriter of stringRewriters) {
    try {
      result = rewriter.rewrite(result, context)
    } catch (error) {
      console.error(`String rewriter "${rewriter.name}" failed:`, error)
    }
  }

  return {
    output: result,
    node: currentNode
  }
}

/**
 * Rewrite an HTML+ERB template string
 *
 * Convenience wrapper around `rewrite()` that parses the string first.
 *
 * @example
 * ```typescript
 * import { Herb } from '@herb-tools/node-wasm'
 * import { rewriteString } from '@herb-tools/rewriter'
 * import { tailwindClassSorter } from '@herb-tools/rewriter/loader'
 *
 * await Herb.load()
 *
 * const template = '<div class="text-red-500 p-4 mt-2"></div>'
 * const output = rewriteString(Herb, template, [tailwindClassSorter()])
 * // output: '<div class="mt-2 p-4 text-red-500"></div>'
 * ```
 *
 * @param herb - The Herb backend instance for parsing
 * @param template - The HTML+ERB template string to rewrite
 * @param rewriters - Array of rewriter instances to apply
 * @param options - Optional configuration for the rewrite operation
 * @returns The rewritten template string
 */
export function rewriteString(herb: HerbBackend, template: string, rewriters: Rewriter[], options: RewriteOptions = {}): string {
  const parseResult = herb.parse(template, { track_whitespace: true })

  if (parseResult.failed) {
    return template
  }

  const { output } = rewrite(
    parseResult.value,
    rewriters,
    options
  )

  return output
}
