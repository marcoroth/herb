import { ActionViewTagHelperToHTMLRewriter } from "./action-view-tag-helper-to-html.js"
import { HTMLToActionViewTagHelperRewriter } from "./html-to-action-view-tag-helper.js"
import { TailwindClassSorterRewriter } from "./tailwind-class-sorter.js"

import type { RewriterClass } from "../type-guards.js"

/**
 * All built-in rewriters available in the package
 */
export const builtinRewriters: RewriterClass[] = [
  ActionViewTagHelperToHTMLRewriter,
  HTMLToActionViewTagHelperRewriter,
  TailwindClassSorterRewriter
]

/**
 * Get a built-in rewriter by name
 */
export function getBuiltinRewriter(name: string): RewriterClass | undefined {
  return builtinRewriters.find(RewriterClass => {
    const instance = new RewriterClass()

    return instance.name === name
  })
}

/**
 * Get all built-in rewriter names
 */
export function getBuiltinRewriterNames(): string[] {
  return builtinRewriters.map(RewriterClass => {
    const instance = new RewriterClass()

    return instance.name
  })
}

export { ActionViewTagHelperToHTMLRewriter } from "./action-view-tag-helper-to-html.js"
export { HTMLToActionViewTagHelperRewriter } from "./html-to-action-view-tag-helper.js"
export { TailwindClassSorterRewriter } from "./tailwind-class-sorter.js"
