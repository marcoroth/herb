import { BrowserScopedStyleNoUnusedSelectorRule } from "./rules/browser-scoped-style-no-unused-selector.js"

import type { BrowserRuleClass } from "./rule.js"

export const browserRules: BrowserRuleClass[] = [
  BrowserScopedStyleNoUnusedSelectorRule as BrowserRuleClass,
]
