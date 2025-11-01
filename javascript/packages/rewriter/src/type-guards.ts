import { ASTRewriter } from "./ast-rewriter.js"
import { StringRewriter } from "./string-rewriter.js"

/**
 * Type guard to check if a class is an ASTRewriter
 */
export function isASTRewriterClass(obj: any): obj is new () => ASTRewriter {
  return (
    typeof obj === 'function' &&
    obj.prototype instanceof ASTRewriter
  )
}

/**
 * Type guard to check if a class is a StringRewriter
 */
export function isStringRewriterClass(obj: any): obj is new () => StringRewriter {
  return (
    typeof obj === 'function' &&
    obj.prototype instanceof StringRewriter
  )
}

/**
 * Union type for all rewriter classes
 */
export type RewriterClass =
  | (new () => ASTRewriter)
  | (new () => StringRewriter)

/**
 * Type guard to check if a class is any kind of rewriter
 */
export function isRewriterClass(obj: any): obj is RewriterClass {
  return isASTRewriterClass(obj) || isStringRewriterClass(obj)
}
