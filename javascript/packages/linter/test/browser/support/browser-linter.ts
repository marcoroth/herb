import { Linter } from "../../../src/linter.js"
import { HerbDOMBackend } from "../../../src/browser/backend.js"

import type { Config } from "@herb-tools/config"
import type { FullRuleConfig } from "../../../src/types.js"

interface LinterOptions {
  only?: string[]
  config?: Config
}

/**
 * A linter that parses with the browser, for a test about what the linter does with a rendered
 * page. `createBrowserRuleTest` is the one to reach for when the test is about a single rule and
 * the offenses it reports.
 *
 *     createBrowserLinter({ only: ["html-no-duplicate-ids"] }).lintElement(root)
 */
export function createBrowserLinter({ only, config }: LinterOptions = {}): Linter {
  return Linter.from(new HerbDOMBackend(), config, undefined, only ? { only } : undefined)
}

export function ruleFor(ruleName: string): { ruleName: string; defaultConfig?: FullRuleConfig } {
  const ruleClass = createBrowserLinter().rules.find((candidate) => candidate.ruleName === ruleName)

  if (!ruleClass) {
    throw new Error(`No rule named "${ruleName}"`)
  }

  return new ruleClass() as { ruleName: string; defaultConfig?: FullRuleConfig }
}
