import type { RewriterClass } from "../type-guards.js"

export { TailwindClassSorterRewriter } from "./tailwind-class-sorter.js"
import { TailwindClassSorterRewriter } from "./tailwind-class-sorter.js"

/**
 * All built-in rewriters available in the package
 */
export const builtinRewriters: RewriterClass[] = [
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
