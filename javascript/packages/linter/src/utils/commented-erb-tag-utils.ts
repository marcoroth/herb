import { commentedERBTagPrefixes } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"

import type { ParseResult, Token, ERBNode } from "@herb-tools/core"
import type { BaseAutofixContext, LintContext, Mutable } from "../types.js"

export interface CommentedERBTagAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBNode>
  openTag: Token
  closeTag: Token
  content: string
  fixType: "after-open" | "before-close" | "after-comment-equals"
}

export function commentedTagPrefixesFor(result: ParseResult, context?: Partial<LintContext>): string[] {
  return commentedERBTagPrefixes(context?.herb?.defaultERBOpenings() ?? [], result.options.erb_openers)
}

export function matchingCommentedTagPrefix(content: string, prefixes: string[]): string | null {
  return prefixes.find(prefix => content.startsWith(prefix)) ?? null
}

export function respacedCommentedTag(content: string, prefixes: string[], rewriteRest?: (rest: string) => string): string | null {
  const prefix = matchingCommentedTagPrefix(content, prefixes)

  if (!prefix) return null

  const rest = content.substring(prefix.length)

  return `${prefix} ${rewriteRest ? rewriteRest(rest) : rest}`
}

export abstract class CommentedERBTagVisitor<
  TAutofixContext extends CommentedERBTagAutofixContext = CommentedERBTagAutofixContext,
> extends BaseRuleVisitor<TAutofixContext> {
  private readonly tagPrefixes: string[]

  constructor(ruleName: string, tagPrefixes: string[], context?: Partial<LintContext>) {
    super(ruleName, context)

    this.tagPrefixes = tagPrefixes
  }

  protected getCommentedTagPrefix(content: string): string | null {
    return matchingCommentedTagPrefix(content, this.tagPrefixes)
  }
}
