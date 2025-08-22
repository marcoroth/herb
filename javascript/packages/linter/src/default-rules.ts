import type { RuleClass } from "./types.js"

import { ERBNoEmptyTagsRule } from "./rules/erb-no-empty-tags.js"
import { ERBNoOutputControlFlowRule } from "./rules/erb-no-output-control-flow.js"
import { ERBNoSilentTagInAttributeNameRule } from "./rules/erb-no-silent-tag-in-attribute-name.js"
import { ERBPreferImageTagHelperRule } from "./rules/erb-prefer-image-tag-helper.js"
import { ERBRequiresTrailingNewlineRule } from "./rules/erb-requires-trailing-newline.js"
import { ERBRequireWhitespaceRule } from "./rules/erb-require-whitespace-inside-tags.js"
import { HTMLAnchorRequireHrefRule } from "./rules/html-anchor-require-href.js"
import { HTMLAriaAttributeMustBeValid } from "./rules/html-aria-attribute-must-be-valid.js"
import { HTMLAriaLabelIsWellFormattedRule } from "./rules/html-aria-label-is-well-formatted.js"
import { HTMLAriaLevelMustBeValidRule } from "./rules/html-aria-level-must-be-valid.js"
import { HTMLAriaRoleHeadingRequiresLevelRule } from "./rules/html-aria-role-heading-requires-level.js"
import { HTMLAriaRoleMustBeValidRule } from "./rules/html-aria-role-must-be-valid.js"
import { HTMLAttributeDoubleQuotesRule } from "./rules/html-attribute-double-quotes.js"
import { HTMLAttributeEqualsSpacingRule } from "./rules/html-attribute-equals-spacing.js"
import { HTMLAttributeValuesRequireQuotesRule } from "./rules/html-attribute-values-require-quotes.js"
import { HTMLAvoidBothDisabledAndAriaDisabledRule } from "./rules/html-avoid-both-disabled-and-aria-disabled.js"
import { HTMLBooleanAttributesNoValueRule } from "./rules/html-boolean-attributes-no-value.js"
import { HTMLIframeHasTitleRule } from "./rules/html-iframe-has-title.js"
import { HTMLImgRequireAltRule } from "./rules/html-img-require-alt.js"
import { HTMLNavigationHasLabelRule } from "./rules/html-navigation-has-label.js"
import { HTMLNoAriaHiddenOnFocusableRule } from "./rules/html-no-aria-hidden-on-focusable.js"
// import { HTMLNoBlockInsideInlineRule } from "./rules/html-no-block-inside-inline.js"
import { HTMLNoDuplicateAttributesRule } from "./rules/html-no-duplicate-attributes.js"
import { HTMLNoDuplicateIdsRule } from "./rules/html-no-duplicate-ids.js"
import { HTMLNoEmptyHeadingsRule } from "./rules/html-no-empty-headings.js"
import { HTMLNoNestedLinksRule } from "./rules/html-no-nested-links.js"
import { HTMLNoPositiveTabIndexRule } from "./rules/html-no-positive-tab-index.js"
import { HTMLNoSelfClosingRule } from "./rules/html-no-self-closing.js"
import { HTMLNoTitleAttributeRule } from "./rules/html-no-title-attribute.js"
import { HTMLTagNameLowercaseRule } from "./rules/html-tag-name-lowercase.js"
import { ParserNoErrorsRule } from "./rules/parser-no-errors.js"
import { SVGTagNameCapitalizationRule } from "./rules/svg-tag-name-capitalization.js"

export const defaultRules: RuleClass[] = [
  ERBNoEmptyTagsRule,
  ERBNoOutputControlFlowRule,
  ERBNoSilentTagInAttributeNameRule,
  ERBPreferImageTagHelperRule,
  ERBRequiresTrailingNewlineRule,
  ERBRequireWhitespaceRule,
  HTMLAnchorRequireHrefRule,
  HTMLAriaAttributeMustBeValid,
  HTMLAriaLabelIsWellFormattedRule,
  HTMLAriaLevelMustBeValidRule,
  HTMLAriaRoleHeadingRequiresLevelRule,
  HTMLAriaRoleMustBeValidRule,
  HTMLAttributeDoubleQuotesRule,
  HTMLAttributeEqualsSpacingRule,
  HTMLAttributeValuesRequireQuotesRule,
  HTMLAvoidBothDisabledAndAriaDisabledRule,
  HTMLBooleanAttributesNoValueRule,
  HTMLIframeHasTitleRule,
  HTMLImgRequireAltRule,
  HTMLNavigationHasLabelRule,
  HTMLNoAriaHiddenOnFocusableRule,
  // HTMLNoBlockInsideInlineRule,
  HTMLNoDuplicateAttributesRule,
  HTMLNoDuplicateIdsRule,
  HTMLNoEmptyHeadingsRule,
  HTMLNoNestedLinksRule,
  HTMLNoPositiveTabIndexRule,
  HTMLNoSelfClosingRule,
  HTMLNoTitleAttributeRule,
  HTMLTagNameLowercaseRule,
  ParserNoErrorsRule,
  SVGTagNameCapitalizationRule,
]
