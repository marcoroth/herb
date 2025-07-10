import type { RuleClass } from "./types.js"

import { ERBNoEmptyTagsRule } from "./rules/erb-no-empty-tags.js"
import { ERBNoOutputControlFlowRule } from "./rules/erb-no-output-control-flow.js"
import { ERBRequireWhitespaceRule } from "./rules/erb-require-whitespace-inside-tags.js"
import { HTMLAnchorRequireHrefRule } from "./rules/html-anchor-require-href.js"
import { HTMLAriaRoleHeadingRequiresLevelRule } from "./rules/html-aria-role-heading-requires-level.js"
import { HTMLAriaRoleMustBeValidRule } from "./rules/html-aria-role-must-be-valid.js"
import { HTMLAttributeDoubleQuotesRule } from "./rules/html-attribute-double-quotes.js"
import { HTMLAttributeValuesRequireQuotesRule } from "./rules/html-attribute-values-require-quotes.js"
import { HTMLBooleanAttributesNoValueRule } from "./rules/html-boolean-attributes-no-value.js"
import { HTMLImgRequireAltRule } from "./rules/html-img-require-alt.js"
import { HTMLNoBlockInsideInlineRule } from "./rules/html-no-block-inside-inline.js"
import { HTMLNoDuplicateAttributesRule } from "./rules/html-no-duplicate-attributes.js"
import { HTMLNoEmptyHeadingsRule } from "./rules/html-no-empty-headings.js"
import { HTMLNoNestedLinksRule } from "./rules/html-no-nested-links.js"
import { HTMLTagNameLowercaseRule } from "./rules/html-tag-name-lowercase.js"

export const defaultRules: RuleClass[] = [
  ERBNoEmptyTagsRule,
  ERBNoOutputControlFlowRule,
  ERBRequireWhitespaceRule,
  HTMLAnchorRequireHrefRule,
  HTMLAriaRoleHeadingRequiresLevelRule,
  HTMLAriaRoleMustBeValidRule,
  HTMLAttributeDoubleQuotesRule,
  HTMLAttributeValuesRequireQuotesRule,
  HTMLBooleanAttributesNoValueRule,
  HTMLImgRequireAltRule,
  HTMLNoBlockInsideInlineRule,
  HTMLNoDuplicateAttributesRule,
  HTMLNoEmptyHeadingsRule,
  HTMLNoNestedLinksRule,
  HTMLTagNameLowercaseRule,
]
