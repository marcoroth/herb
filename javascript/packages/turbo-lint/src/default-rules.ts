import { HtmlTurboPermanentRule } from "./rules/html-turbo-permanent.js"

import type { RuleClass } from "./types.js"

/**
 * Default set of Turbo linting rules
 */
export const defaultRules: RuleClass[] = [
  HtmlTurboPermanentRule
]