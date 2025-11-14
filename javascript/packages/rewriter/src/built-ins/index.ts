import type { RewriterClass } from "../type-guards.js"

// Re-export for users who want to import directly
export { TailwindClassSorterRewriter } from "./tailwind-class-sorter.js"

/**
 * Registry of built-in rewriters with lazy loading to avoid
 * loading heavy dependencies (like tailwindcss) unless needed
 */
const builtinRewriterRegistry = {
  "tailwind-class-sorter": async () => {
    const { TailwindClassSorterRewriter } = await import("./tailwind-class-sorter.js")
    return TailwindClassSorterRewriter
  }
}

/**
 * All built-in rewriters available in the package.
 * Note: This loads all rewriters eagerly. For lazy loading, use getBuiltinRewriter().
 */
export const builtinRewriters: RewriterClass[] = []

/**
 * Get a built-in rewriter by name (lazy loaded)
 */
export async function getBuiltinRewriter(name: string): Promise<RewriterClass | undefined> {
  const loader = builtinRewriterRegistry[name as keyof typeof builtinRewriterRegistry]
  if (!loader) return undefined

  return await loader()
}

/**
 * Get all built-in rewriter names
 */
export function getBuiltinRewriterNames(): string[] {
  return Object.keys(builtinRewriterRegistry)
}
