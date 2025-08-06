import { getTailwindConfig } from './config.js'
import { sortClasses, sortClassList } from './sorting.js'

import type { SortTailwindClassesOptions, SortEnv, ContextContainer } from './types.js'

/**
 * A reusable Tailwind CSS class sorter that holds a context for efficient sorting.
 * Use this when you need to sort classes multiple times with the same configuration.
 */
export class TailwindClassSorter {
  private env: SortEnv

  /**
   * Create a new TailwindClassSorter with a pre-loaded context.
   *
   * @param contextContainer - Pre-loaded Tailwind context and generateRules function
   * @param options - Configuration options (merged with context)
   */
  constructor(contextContainer: ContextContainer, options: SortTailwindClassesOptions = {}) {
    this.env = {
      context: contextContainer.context,
      generateRules: contextContainer.generateRules,
      options
    }
  }

  /**
   * Create a TailwindClassSorter by loading a Tailwind config file.
   *
   * @param options - Configuration options including config file path
   * @returns Promise resolving to a new TailwindClassSorter instance
   */
  static async fromConfig(options: SortTailwindClassesOptions = {}): Promise<TailwindClassSorter> {
    const contextContainer = await getTailwindConfig(options)
    return new TailwindClassSorter(contextContainer, options)
  }

  /**
   * Sort Tailwind CSS classes synchronously.
   *
   * @param classStr - String of space-separated CSS classes
   * @param overrideOptions - Options to override the instance options for this sort
   * @returns Sorted class string
   */
  sortClasses(classStr: string, overrideOptions?: Partial<SortTailwindClassesOptions>): string {
    if (!classStr || typeof classStr !== 'string') {
      return classStr
    }

    const env = overrideOptions ? {
      ...this.env,
      options: { ...this.env.options, ...overrideOptions }
    } : this.env

    return sortClasses(classStr, { env })
  }

  /**
   * Sort a list of Tailwind CSS classes synchronously.
   *
   * @param classList - Array of CSS classes
   * @param overrideOptions - Options to override the instance options for this sort
   * @returns Object with sorted classList and removed indices
   */
  sortClassList(
    classList: string[],
    overrideOptions?: Partial<SortTailwindClassesOptions>
  ): { classList: string[], removedIndices: Set<number> } {
    if (!Array.isArray(classList)) {
      return { classList, removedIndices: new Set() }
    }

    const env = overrideOptions ? {
      ...this.env,
      options: { ...this.env.options, ...overrideOptions }
    } : this.env

    const effectiveOptions = env.options
    const removeDuplicates = overrideOptions?.tailwindPreserveDuplicates !== undefined
      ? !overrideOptions.tailwindPreserveDuplicates
      : !effectiveOptions.tailwindPreserveDuplicates

    return sortClassList(classList, { env, removeDuplicates })
  }

  /**
   * Get the underlying context container.
   *
   * @returns The context container used by this sorter
   */
  getContext(): ContextContainer {
    return {
      context: this.env.context,
      generateRules: this.env.generateRules
    }
  }

  /**
   * Get the current options.
   *
   * @returns The options used by this sorter
   */
  getOptions(): SortTailwindClassesOptions {
    return { ...this.env.options }
  }
}
