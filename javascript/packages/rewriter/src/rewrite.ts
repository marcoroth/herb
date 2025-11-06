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
 * import { rewrite, tailwindClassSorter } from '@herb-tools/rewriter'
 *
 * await Herb.load()
 *
 * const template = '<div class="text-red-500 p-4 mt-2"></div>'
 * const parseResult = Herb.parse(template)
 * const { output, document } = await rewrite(parseResult.value, [tailwindClassSorter()])
 * ```
 *
 * @param node - The AST Node to rewrite
 * @param rewriters - Array of rewriter instances to apply
 * @param options - Optional configuration for the rewrite operation
 * @returns Object containing the rewritten string and Node
 */
export async function rewrite<T extends Node>(node: T, rewriters: Rewriter[], options: RewriteOptions = {}): Promise<RewriteResult & { node: T }> {
  const { baseDir = process.cwd(), filePath } = options

  const context: RewriteContext = { baseDir, filePath }

  for (const rewriter of rewriters) {
    await rewriter.initialize(context)
  }

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
 * import { rewriteString, tailwindClassSorter } from '@herb-tools/rewriter'
 *
 * await Herb.load()
 *
 * const template = '<div class="text-red-500 p-4 mt-2"></div>'
 * const { output, node } = await rewriteString(Herb, template, [tailwindClassSorter()])
 * ```
 *
 * @param herb - The Herb backend instance for parsing
 * @param template - The HTML+ERB template string to rewrite
 * @param rewriters - Array of rewriter instances to apply
 * @param options - Optional configuration for the rewrite operation
 * @returns Object containing the rewritten string and Node
 */
export async function rewriteString(herb: HerbBackend, template: string, rewriters: Rewriter[], options: RewriteOptions = {}): Promise<RewriteResult> {
  const parseResult = herb.parse(template, { track_whitespace: true })

  if (parseResult.failed) {
    return {
      output: template,
      node: parseResult.value
    }
  }

  return await rewrite(parseResult.value, rewriters, options)
}
