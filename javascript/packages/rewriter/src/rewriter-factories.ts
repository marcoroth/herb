import { TailwindClassSorterRewriter } from "./built-ins/tailwind-class-sorter.js"

export interface TailwindClassSorterOptions {
  /**
   * Base directory for resolving Tailwind configuration
   * Defaults to process.cwd()
   */
  baseDir?: string
}

/**
 * Factory function for creating a Tailwind class sorter rewriter
 *
 * @example
 * ```typescript
 * import { rewrite, tailwindClassSorter } from '@herb-tools/rewriter'
 *
 * const template = '<div class="text-red-500 p-4 mt-2"></div>'
 * const result = await rewrite(template, [tailwindClassSorter()])
 * // Result: '<div class="mt-2 p-4 text-red-500"></div>'
 * ```
 *
 * @param options - Optional configuration for the Tailwind class sorter
 * @returns A configured TailwindClassSorterRewriter instance
 */
export function tailwindClassSorter(options: TailwindClassSorterOptions = {}): TailwindClassSorterRewriter {
  const rewriter = new TailwindClassSorterRewriter()

  if (options.baseDir) {
    const originalInitialize = rewriter.initialize.bind(rewriter)

    rewriter.initialize = async (context) => {
      return originalInitialize({ ...context, baseDir: options.baseDir || context.baseDir })
    }
  }

  return rewriter
}
