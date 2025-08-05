/**
 * Tailwind CSS Class Sorter Rewriter
 *
 * This rewriter sorts Tailwind CSS classes in HTML class attributes
 * according to Tailwind's recommended order.
 */

import { Node, Token } from "@herb-tools/core"
import { Rewriter, RewriterOptions, RewriterResult } from "../../rewriter.js"
import { TailwindVisitor } from "./visitor.js"
import { TailwindRewriter } from "./rewriter.js"

export interface TailwindClassSorterOptions extends RewriterOptions {
  // No additional options needed for now
}

/**
 * TailwindClassSorter provides Tailwind CSS class sorting functionality
 * Extends the base Rewriter class to inherit visitor capabilities
 */
export class TailwindClassSorter extends Rewriter {
  constructor(options: TailwindClassSorterOptions = {}) {
    super(options)
  }

  /**
   * Process a single node - implementation of abstract method from Rewriter
   */
  protected processNode(node: Node | Token): boolean {
    // Check if it's a node-like object (has a type property starting with AST_)
    if (!node || typeof node !== 'object' || !(node as any).type?.startsWith('AST_')) {
      return false
    }

    // Step 1: Visit the AST to find all class attributes
    const visitor = new TailwindVisitor(this.options.enabled)
    visitor.visit(node as Node)

    // Step 2: Sort all found class attributes
    visitor.sortAllClassAttributes()

    const visitorStatistics = visitor.getStatistics()
    const hasModifications = visitor.hasModifications()

    // Update our statistics
    this.statistics.total += visitorStatistics.total
    this.statistics.modified += visitorStatistics.modified
    this.statistics.skipped += visitorStatistics.skipped

    // Step 3: If there are modifications, apply them back to the AST
    if (hasModifications) {
      const rewriter = new TailwindRewriter(visitor.getClassAttributes())
      rewriter.visit(node as Node)
    }

    return hasModifications
  }

  /**
   * Create a new sorter instance with different options
   */
  withOptions(options: Partial<TailwindClassSorterOptions>): TailwindClassSorter {
    return new TailwindClassSorter({
      ...this.options,
      ...options
    })
  }
}

// Re-export core functions for direct use
export { sortTailwindClasses, sortTailwindClassArray, containsTailwindClasses } from "./sorter.js"

// Re-export low-level components for advanced usage
export { TailwindVisitor, ClassAttribute } from "./visitor.js"
export { TailwindRewriter, TailwindSortOptions } from "./rewriter.js"

/**
 * Default options for the Tailwind class sorter
 */
export const defaultTailwindClassSorterOptions: Required<TailwindClassSorterOptions> = {
  enabled: true,
  verbose: false
}

/**
 * Convenience function to create a sorter and process an AST in one call
 */
export function sortTailwindClassesInAST(
  ast: Node | Token,
  options: TailwindClassSorterOptions = {}
): RewriterResult {
  const sorter = new TailwindClassSorter(options)
  return sorter.process(ast)
}
