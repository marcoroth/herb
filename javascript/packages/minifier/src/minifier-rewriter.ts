import { ASTRewriter } from "@herb-tools/rewriter"
import { MinifierVisitor } from "./minifier-visitor.js"

import type { RewriteContext } from "@herb-tools/rewriter"
import type { Node } from "@herb-tools/core"

export class MinifyRewriter extends ASTRewriter {
  get name() {
    return "Minifier"
  }

  get description() {
    return "Minifies HTML+ERB documents by removing non-significant whitespace."
  }

  rewrite<T extends Node>(node: T, _context?: RewriteContext): T {
    const visitor = new MinifierVisitor()

    node.accept(visitor)

    return node
  }
}
