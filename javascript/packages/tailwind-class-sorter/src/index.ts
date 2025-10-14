import { getTailwindConfig } from './config.js'
import { sortClasses, sortClassList } from './sorting.js'
import type { SortTailwindClassesOptions, SortEnv } from './types.js'

export type { SortTailwindClassesOptions, ContextContainer } from './types.js'
export { TailwindClassSorter } from './sorter.js'

/**
 * Sort Tailwind CSS classes according to the recommended class order.
 *
 * @param classStr - String of space-separated CSS classes
 * @param options - Configuration options
 * @returns Sorted class string
 */
export async function sortTailwindClasses(
  classStr: string,
  options: SortTailwindClassesOptions = {}
): Promise<string> {
  if (!classStr || typeof classStr !== 'string') {
    return classStr
  }

  const { context, generateRules } = await getTailwindConfig(options)

  const env: SortEnv = {
    context,
    generateRules,
    options
  }

  return sortClasses(classStr, { env })
}

/**
 * Sort a list of Tailwind CSS classes.
 *
 * @param classList - Array of CSS classes
 * @param options - Configuration options
 * @returns Object with sorted classList and removed indices
 */
export async function sortTailwindClassList(
  classList: string[],
  options: SortTailwindClassesOptions = {}
) {
  if (!Array.isArray(classList)) {
    return { classList, removedIndices: new Set() }
  }

  const { context, generateRules } = await getTailwindConfig(options)

  const env: SortEnv = {
    context,
    generateRules,
    options
  }

  return sortClassList(classList, {
    env,
    removeDuplicates: !options.tailwindPreserveDuplicates
  })
}

export { sortClasses, sortClassList } from './sorting.js'
export { getTailwindConfig } from './config.js'
