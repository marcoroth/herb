export interface SortTailwindClassesOptions {
  /**
   * Path to the Tailwind config file.
   */
  tailwindConfig?: string

  /**
   * Path to the CSS stylesheet used by Tailwind CSS (v4+)
   */
  tailwindStylesheet?: string

  /**
   * Preserve whitespace around Tailwind classes when sorting.
   */
  tailwindPreserveWhitespace?: boolean

  /**
   * Preserve duplicate classes inside a class list when sorting.
   */
  tailwindPreserveDuplicates?: boolean

  /**
   * Base directory for resolving config files (defaults to process.cwd())
   */
  baseDir?: string
}

export interface TailwindContext {
  tailwindConfig: {
    prefix: string | ((selector: string) => string)
  }

  getClassOrder?: (classList: string[]) => [string, bigint | null][]

  layerOrder: {
    components: bigint
  }
}

export interface SortEnv {
  context: TailwindContext | null
  generateRules: ((
    classes: Iterable<string>,
    context: TailwindContext,
  ) => [bigint][]) | null
  options: SortTailwindClassesOptions
}

export interface ContextContainer {
  context: any | null
  generateRules: ((
    classes: Iterable<string>,
    context: TailwindContext,
  ) => [bigint][]) | null
}
