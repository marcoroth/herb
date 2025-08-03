/**
 * Abstract Rewriter
 * 
 * Base class for all AST rewriters. Extends the core Visitor to traverse
 * and modify HTML+ERB AST nodes.
 * 
 * This class can be used for:
 * - Code formatting transformations (like Tailwind class sorting)
 * - Linter auto-fixes (fixing violations automatically)
 * - Code refactoring tools
 * - Custom AST transformations
 */

import { Visitor, Node, Token } from "@herb-tools/core"

/**
 * Standard result interface for all rewriters
 */
export interface RewriterResult {
  /** Whether any modifications were made */
  modified: boolean
  /** Statistics about the rewriting operation */
  statistics: {
    /** Total number of nodes/elements processed */
    total: number
    /** Number of nodes/elements that were modified */
    modified: number
    /** Number of nodes/elements that were skipped */
    skipped: number
  }
}

/**
 * Base options that all rewriters should support
 */
export interface RewriterOptions {
  /** Whether the rewriter is enabled */
  enabled?: boolean
  /** Whether to log verbose information */
  verbose?: boolean
}

/**
 * Abstract base class for all rewriters
 * Extends the core Visitor to provide AST traversal capabilities
 */
export abstract class Rewriter extends Visitor {
  protected options: Required<RewriterOptions>
  protected statistics = { total: 0, modified: 0, skipped: 0 }

  constructor(options: RewriterOptions = {}) {
    super()
    this.options = {
      enabled: options.enabled ?? true,
      verbose: options.verbose ?? false
    }
  }

  /**
   * Process an AST node and apply transformations
   */
  process(ast: Node | Token): RewriterResult {
    if (!this.options.enabled) {
      return { 
        modified: false, 
        statistics: { total: 0, modified: 0, skipped: 0 } 
      }
    }

    // Reset statistics
    this.statistics = { total: 0, modified: 0, skipped: 0 }
    
    // Process the AST
    const modified = this.processNode(ast)

    return {
      modified,
      statistics: { ...this.statistics }
    }
  }

  /**
   * Process a single node - implemented by subclasses
   */
  protected abstract processNode(node: Node | Token): boolean

  /**
   * Check if the rewriter is enabled
   */
  isEnabled(): boolean {
    return this.options.enabled
  }

  /**
   * Get current options
   */
  getOptions(): Required<RewriterOptions> {
    return { ...this.options }
  }

  /**
   * Log information if verbose mode is enabled
   */
  protected log(message: string): void {
    if (this.options.verbose) {
      console.log(`[${this.constructor.name}] ${message}`)
    }
  }

  /**
   * Log warning if verbose mode is enabled
   */
  protected warn(message: string, error?: Error): void {
    if (this.options.verbose) {
      console.warn(`[${this.constructor.name}] ${message}`, error || '')
    }
  }

  /**
   * Track that a node was processed
   */
  protected trackProcessed(): void {
    this.statistics.total++
  }

  /**
   * Track that a node was modified
   */
  protected trackModified(): void {
    this.statistics.modified++
  }

  /**
   * Track that a node was skipped
   */
  protected trackSkipped(): void {
    this.statistics.skipped++
  }
}