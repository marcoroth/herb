export * from "./index.js"

export { CustomRuleLoader } from "./custom-rule-loader.js"
export type { CustomRuleLoaderOptions } from "./custom-rule-loader.js"

import { CustomRuleLoader } from "./custom-rule-loader.js"
import type { RuleClass } from "./types.js"

/**
 * Loads custom rules from the filesystem.
 * Only available in Node.js environments.
 */
export async function loadCustomRules(options?: {
  baseDir?: string
  patterns?: string[]
  silent?: boolean
}): Promise<{
  rules: RuleClass[]
  ruleInfo: Array<{ name: string, path: string }>
  warnings: string[]
}> {
  const loader = new CustomRuleLoader(options)
  const { rules: customRules, ruleInfo, duplicateWarnings } = await loader.loadRulesWithInfo()

  return {
    rules: customRules,
    ruleInfo,
    warnings: duplicateWarnings
  }
}
