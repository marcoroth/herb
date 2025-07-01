import type { RuleClass } from "./types.js"

import { ERBNoOutputControlFlow } from "./rules/erb-no-output-control-flow.js"
import { HTMLAriaRoleHeadingRequiresLevelRule } from "./rules/html-aria-role-heading-requires-level.js"
import { HTMLTagNameLowercaseRule } from "./rules/html-tag-name-lowercase.js"
import { HTMLNoDuplicateAttributesRule } from "./rules/html-no-duplicate-attributes.js"
import { HTMLImgRequireAltRule } from "./rules/html-img-require-alt.js"
import { HTMLAttributeValuesRequireQuotesRule } from "./rules/html-attribute-values-require-quotes.js"
import { HTMLNoNestedLinksRule } from "./rules/html-no-nested-links.js"
import { HTMLAttributeDoubleQuotesRule } from "./rules/html-attribute-double-quotes.js"
import { HTMLBooleanAttributesNoValueRule } from "./rules/html-boolean-attributes-no-value.js"
import { HTMLNoBlockInsideInlineRule } from "./rules/html-no-block-inside-inline.js"
import { HTMLNoEmptyHeadingsRule } from "./rules/html-no-empty-headings.js"

export const defaultRules: RuleClass[] = [
  ERBNoOutputControlFlow,
  HTMLAriaRoleHeadingRequiresLevelRule,
  HTMLTagNameLowercaseRule,
  HTMLNoDuplicateAttributesRule,
  HTMLImgRequireAltRule,
  HTMLAttributeValuesRequireQuotesRule,
  HTMLNoNestedLinksRule,
  HTMLAttributeDoubleQuotesRule,
  HTMLBooleanAttributesNoValueRule,
  HTMLNoBlockInsideInlineRule,
  HTMLNoEmptyHeadingsRule,
]
