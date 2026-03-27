import { TailwindClassSorterRewriter } from "./built-ins/tailwind-class-sorter.js"
import { ActionViewTagHelperToHTMLRewriter } from "./built-ins/action-view-tag-helper-to-html.js"
import { HTMLToActionViewTagHelperRewriter } from "./built-ins/html-to-action-view-tag-helper.js"

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
 * Automatically initializes the rewriter before returning it.
 *
 * @example
 * ```typescript
 * import { rewrite } from '@herb-tools/rewriter'
 * import { tailwindClassSorter } from '@herb-tools/rewriter/loader'
 *
 * const template = '<div class="text-red-500 p-4 mt-2"></div>'
 * const sorter = await tailwindClassSorter()
 * const result = rewrite(template, [sorter])
 * // Result: '<div class="mt-2 p-4 text-red-500"></div>'
 * ```
 *
 * @param options - Optional configuration for the Tailwind class sorter
 * @returns A configured and initialized TailwindClassSorterRewriter instance
 */
export async function tailwindClassSorter(options: TailwindClassSorterOptions = {}): Promise<TailwindClassSorterRewriter> {
  const rewriter = new TailwindClassSorterRewriter()
  const baseDir = options.baseDir || process.cwd()

  await rewriter.initialize({ baseDir })

  return rewriter
}

export function actionViewTagHelperToHTML(): ActionViewTagHelperToHTMLRewriter {
  return new ActionViewTagHelperToHTMLRewriter()
}

export function htmlToActionViewTagHelper(): HTMLToActionViewTagHelperRewriter {
  return new HTMLToActionViewTagHelperRewriter()
}
