import type { CustomRewriterLoaderOptions } from "@herb-tools/rewriter/loader"

export interface FormatterRewriterOptions extends CustomRewriterLoaderOptions {
  /**
   * Whether to load custom rewriters from the project
   * Defaults to true
   */
  loadCustomRewriters?: boolean

  /**
   * Names of pre-format rewriters to run (in order)
   */
  pre?: string[]

  /**
   * Names of post-format rewriters to run (in order)
   */
  post?: string[]
}

export interface FormatterRewriterInfo {
  preCount: number
  postCount: number
  warnings: string[]
  preNames: string[]
  postNames: string[]
}
