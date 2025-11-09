import type { Node } from "@herb-tools/core"
import type { RewriteContext } from "./context.js"

/**
 * Base class for AST rewriters that transform AST nodes before formatting
 *
 * AST rewriters receive a Node and can mutate it in place or return a modified Node.
 * They run before the formatting step.
 *
 * @example
 * ```typescript
 * import { ASTRewriter, asMutable } from "@herb-tools/rewriter"
 * import { Visitor } from "@herb-tools/core"
 *
 * class MyRewriter extends ASTRewriter {
 *   get name() { return "my-rewriter" }
 *   get description() { return "My custom AST rewriter" }
 *
 *   async initialize(context) {
 *     // Load config, initialize dependencies, etc.
 *   }
 *
 *   rewrite(node, context) {
 *     // Use visitor pattern to traverse and modify AST
 *     const visitor = new MyVisitor()
 *     visitor.visit(node)
 *
 *     return node
 *   }
 * }
 * ```
 */
export abstract class ASTRewriter {
  /**
   * Unique identifier for this rewriter
   * Used in configuration and error messages
   */
  abstract get name(): string

  /**
   * Human-readable description of what this rewriter does
   */
  abstract get description(): string

  /**
   * Optional async initialization hook
   *
   * Called once before the first rewrite operation. Use this to:
   * - Load configuration files
   * - Initialize dependencies
   * - Perform expensive setup operations
   *
   * @param context - Context with baseDir and optional filePath
   */
  async initialize(_context: RewriteContext): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Transform the AST node
   *
   * This method is called synchronously for each file being formatted.
   * Modify the AST in place or return a new Node.
   *
   * @param node - The AST node from @herb-tools/core
   * @param context - Context with filePath and baseDir
   * @returns The modified Node (can be the same object mutated in place)
   */
  abstract rewrite<T extends Node>(node: T, context: RewriteContext): T
}
