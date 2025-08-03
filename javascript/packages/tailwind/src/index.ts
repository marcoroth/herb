/**
 * @herb-tools/tailwind - Tailwind CSS class sorting for HTML+ERB templates
 * 
 * This package provides Tailwind CSS class sorting functionality using Herb's
 * visitor pattern to parse, analyze, and rewrite HTML+ERB templates.
 */

import { Node, Token } from "@herb-tools/core"
import { TailwindVisitor, ClassAttribute } from "./visitor.js"
import { TailwindRewriter, TailwindSortOptions } from "./rewriter.js"

// Re-export core functions
export { sortTailwindClasses, sortTailwindClassArray, containsTailwindClasses } from "./sorter.js"
export { TailwindVisitor, ClassAttribute } from "./visitor.js"
export { TailwindRewriter, TailwindSortOptions } from "./rewriter.js"

/**
 * Sort Tailwind CSS classes in an AST by visiting all nodes and rewriting class attributes
 */
export async function sortTailwindClassesInAST(
  ast: Node | Token, 
  options: TailwindSortOptions = {}
): Promise<{ 
  modified: boolean, 
  statistics: { total: number, modified: number, skipped: number } 
}> {
  const { enabled = true, verbose = false } = options

  if (!enabled) {
    return { modified: false, statistics: { total: 0, modified: 0, skipped: 0 } }
  }

  // Step 1: Visit the AST to find all class attributes
  const visitor = new TailwindVisitor(enabled)
  if (ast instanceof Node) {
    // Manually traverse the AST since the base visitor may not automatically call our methods
    visitor.visit(ast)
  } else {
    // For Token, we need to handle it differently or skip
    return { modified: false, statistics: { total: 0, modified: 0, skipped: 0 } }
  }

  // Step 2: Sort all found class attributes
  await visitor.sortAllClassAttributes()

  const statistics = visitor.getStatistics()
  const hasModifications = visitor.hasModifications()

  if (verbose) {
    console.log(`Tailwind sorting: ${statistics.modified}/${statistics.total} class attributes sorted`)
  }

  // Step 3: If there are modifications, apply them back to the AST
  if (hasModifications && ast instanceof Node) {
    const rewriter = new TailwindRewriter(visitor.getClassAttributes())
    rewriter.visit(ast)
  }

  return {
    modified: hasModifications,
    statistics
  }
}

/**
 * Default options for Tailwind sorting
 */
export const defaultTailwindSortOptions: Required<TailwindSortOptions> = {
  enabled: false, // Default to false to match formatter behavior
  verbose: false
}