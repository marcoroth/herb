import type { RuleClass } from "./types.js"

import { ERBCommentSyntax } from "./rules/erb-comment-syntax.js";
import { ERBNoCaseNodeChildrenRule } from "./rules/erb-no-case-node-children.js"
import { ERBNoEmptyTagsRule } from "./rules/erb-no-empty-tags.js"
import { ERBNoExtraNewLineRule } from "./rules/erb-no-extra-newline.js"
import { ERBNoExtraWhitespaceRule } from "./rules/erb-no-extra-whitespace-inside-tags.js"
import { ERBNoOutputControlFlowRule } from "./rules/erb-no-output-control-flow.js"
import { ERBNoSilentTagInAttributeNameRule } from "./rules/erb-no-silent-tag-in-attribute-name.js"
import { ERBPreferImageTagHelperRule } from "./rules/erb-prefer-image-tag-helper.js"
import { ERBRequireTrailingNewlineRule } from "./rules/erb-require-trailing-newline.js"
import { ERBRequireWhitespaceRule } from "./rules/erb-require-whitespace-inside-tags.js"
import { ERBRightTrimRule } from "./rules/erb-right-trim.js"

import { HerbDisableCommentValidRuleNameRule } from "./rules/herb-disable-comment-valid-rule-name.js"
import { HerbDisableCommentNoRedundantAllRule } from "./rules/herb-disable-comment-no-redundant-all.js"
import { HerbDisableCommentNoDuplicateRulesRule } from "./rules/herb-disable-comment-no-duplicate-rules.js"
import { HerbDisableCommentMissingRulesRule } from "./rules/herb-disable-comment-missing-rules.js"
import { HerbDisableCommentMalformedRule } from "./rules/herb-disable-comment-malformed.js"
import { HerbDisableCommentUnnecessaryRule } from "./rules/herb-disable-comment-unnecessary.js"

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
import { HTMLBodyOnlyElementsRule } from "./rules/html-body-only-elements.js"
import { HTMLBooleanAttributesNoValueRule } from "./rules/html-boolean-attributes-no-value.js"
import { HTMLHeadOnlyElementsRule } from "./rules/html-head-only-elements.js"
import { HTMLIframeHasTitleRule } from "./rules/html-iframe-has-title.js"
import { HTMLImgRequireAltRule } from "./rules/html-img-require-alt.js"
import { HTMLInputRequireAutocompleteRule } from "./rules/html-input-require-autocomplete.js"
import { HTMLNavigationHasLabelRule } from "./rules/html-navigation-has-label.js"
import { HTMLNoAriaHiddenOnFocusableRule } from "./rules/html-no-aria-hidden-on-focusable.js"
import { HTMLNoBlockInsideInlineRule } from "./rules/html-no-block-inside-inline.js"
import { HTMLNoDuplicateAttributesRule } from "./rules/html-no-duplicate-attributes.js"
import { HTMLNoDuplicateIdsRule } from "./rules/html-no-duplicate-ids.js"
import { HTMLNoDuplicateMetaNamesRule } from "./rules/html-no-duplicate-meta-names.js"
import { HTMLNoEmptyAttributesRule } from "./rules/html-no-empty-attributes.js"
import { HTMLNoEmptyHeadingsRule } from "./rules/html-no-empty-headings.js"
import { HTMLNoNestedLinksRule } from "./rules/html-no-nested-links.js"
import { HTMLNoPositiveTabIndexRule } from "./rules/html-no-positive-tab-index.js"
import { HTMLNoSelfClosingRule } from "./rules/html-no-self-closing.js"
import { HTMLNoSpaceInTagRule } from "./rules/html-no-space-in-tag.js"
import { HTMLNoTitleAttributeRule } from "./rules/html-no-title-attribute.js"
import { HTMLNoUnderscoresInAttributeNamesRule } from "./rules/html-no-underscores-in-attribute-names.js"
import { HTMLTagNameLowercaseRule } from "./rules/html-tag-name-lowercase.js"

import { SVGTagNameCapitalizationRule } from "./rules/svg-tag-name-capitalization.js"

import { ParserNoErrorsRule } from "./rules/parser-no-errors.js"

export const rules: RuleClass[] = [
  ERBCommentSyntax,
  ERBNoCaseNodeChildrenRule,
  ERBNoEmptyTagsRule,
  ERBNoExtraNewLineRule,
  ERBNoExtraWhitespaceRule,
  ERBNoOutputControlFlowRule,
  ERBNoSilentTagInAttributeNameRule,
  ERBPreferImageTagHelperRule,
  ERBRequireTrailingNewlineRule,
  ERBRequireWhitespaceRule,
  ERBRightTrimRule,

  HerbDisableCommentValidRuleNameRule,
  HerbDisableCommentNoRedundantAllRule,
  HerbDisableCommentNoDuplicateRulesRule,
  HerbDisableCommentMissingRulesRule,
  HerbDisableCommentMalformedRule,
  HerbDisableCommentUnnecessaryRule,

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
  HTMLBodyOnlyElementsRule,
  HTMLBooleanAttributesNoValueRule,
  HTMLHeadOnlyElementsRule,
  HTMLIframeHasTitleRule,
  HTMLImgRequireAltRule,
  HTMLInputRequireAutocompleteRule,
  HTMLNavigationHasLabelRule,
  HTMLNoAriaHiddenOnFocusableRule,
  HTMLNoBlockInsideInlineRule,
  HTMLNoDuplicateAttributesRule,
  HTMLNoDuplicateIdsRule,
  HTMLNoDuplicateMetaNamesRule,
  HTMLNoEmptyAttributesRule,
  HTMLNoEmptyHeadingsRule,
  HTMLNoNestedLinksRule,
  HTMLNoPositiveTabIndexRule,
  HTMLNoSelfClosingRule,
  HTMLNoSpaceInTagRule,
  HTMLNoTitleAttributeRule,
  HTMLNoUnderscoresInAttributeNamesRule,
  HTMLTagNameLowercaseRule,

  SVGTagNameCapitalizationRule,

  ParserNoErrorsRule,
]
