import { ASTRewriter } from "./ast-rewriter.js"
import { StringRewriter } from "./string-rewriter.js"

/**
 * Type guard to check if a class is an ASTRewriter
 * Uses duck typing to work across module boundaries
 */
export function isASTRewriterClass(obj: any): obj is new () => ASTRewriter {
  if (typeof obj !== 'function') return false

  if (obj.prototype instanceof ASTRewriter) return true

  let proto = obj.prototype

  while (proto) {
    if (proto.constructor?.name === 'ASTRewriter') return true

    proto = Object.getPrototypeOf(proto)
  }

  return false
}

/**
 * Type guard to check if a class is a StringRewriter
 * Uses duck typing to work across module boundaries
 */
export function isStringRewriterClass(obj: any): obj is new () => StringRewriter {
  if (typeof obj !== 'function') return false

  if (obj.prototype instanceof StringRewriter) return true

  let proto = obj.prototype

  while (proto) {
    if (proto.constructor?.name === 'StringRewriter') return true

    proto = Object.getPrototypeOf(proto)
  }

  return false
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
