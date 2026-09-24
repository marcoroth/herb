export * from "./index.js"

export { CustomRuleLoader } from "./custom-rule-loader.js"
export type { CustomRuleLoaderOptions } from "./custom-rule-loader.js"

import { dirname, resolve } from "node:path"
import { Config } from "@herb-tools/config"

import { CustomRuleLoader } from "./custom-rule-loader.js"
import type { RuleClass } from "./types.js"

/**
 * The directory custom rules are loaded from for a lint run: the one holding
 * the config file passed with `--config-file`, otherwise the project root.
 * Like `Config.load`, a path that does not end in `.herb.yml` is taken as the
 * directory holding the config file.
 */
export function customRulesBaseDir(projectPath?: string, configPath?: string): string | undefined {
  if (!configPath) return projectPath

  const resolved = resolve(configPath)

  return resolved.endsWith(Config.configPath) ? dirname(resolved) : resolved
}

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
