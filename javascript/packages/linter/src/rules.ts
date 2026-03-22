import type { RuleClass } from "./types.js"

import { A11yAnchorRequireHrefRule } from "./rules/a11y-anchor-require-href.js"
import { A11yAriaAttributeMustBeValid } from "./rules/a11y-aria-attribute-must-be-valid.js"
import { A11yAriaLabelIsWellFormattedRule } from "./rules/a11y-aria-label-is-well-formatted.js"
import { A11yAriaLevelMustBeValidRule } from "./rules/a11y-aria-level-must-be-valid.js"
import { A11yAriaRoleHeadingRequiresLevelRule } from "./rules/a11y-aria-role-heading-requires-level.js"
import { A11yAriaRoleMustBeValidRule } from "./rules/a11y-aria-role-must-be-valid.js"
import { A11yAvoidBothDisabledAndAriaDisabledRule } from "./rules/a11y-avoid-both-disabled-and-aria-disabled.js"
import { A11yIframeHasTitleRule } from "./rules/a11y-iframe-has-title.js"
import { A11yImgRequireAltRule } from "./rules/a11y-img-require-alt.js"
import { A11yInputRequireAutocompleteRule } from "./rules/a11y-input-require-autocomplete.js"
import { A11yNavigationHasLabelRule } from "./rules/a11y-navigation-has-label.js"
import { A11yNoAbstractRolesRule } from "./rules/a11y-no-abstract-roles.js"
import { A11yNoAriaHiddenOnBodyRule } from "./rules/a11y-no-aria-hidden-on-body.js"
import { A11yNoAriaHiddenOnFocusableRule } from "./rules/a11y-no-aria-hidden-on-focusable.js"
import { A11yNoEmptyHeadingsRule } from "./rules/a11y-no-empty-headings.js"
import { A11yNoNestedLinksRule } from "./rules/a11y-no-nested-links.js"
import { A11yNoPositiveTabIndexRule } from "./rules/a11y-no-positive-tab-index.js"
import { A11yNoTitleAttributeRule } from "./rules/a11y-no-title-attribute.js"

import { ActionViewNoSilentHelperRule } from "./rules/actionview-no-silent-helper.js"
import { ActionViewNoSilentRenderRule } from "./rules/actionview-no-silent-render.js"
import { ActionViewNoVoidElementContentRule } from "./rules/actionview-no-void-element-content.js"

import { ERBCommentSyntax } from "./rules/erb-comment-syntax.js";
import { ERBNoCaseNodeChildrenRule } from "./rules/erb-no-case-node-children.js"
import { ERBNoEmptyControlFlowRule } from "./rules/erb-no-empty-control-flow.js"
import { ERBNoConditionalHTMLElementRule } from "./rules/erb-no-conditional-html-element.js"
import { ERBNoConditionalOpenTagRule } from "./rules/erb-no-conditional-open-tag.js"
import { ERBNoDuplicateBranchElementsRule } from "./rules/erb-no-duplicate-branch-elements.js"
import { ERBNoEmptyTagsRule } from "./rules/erb-no-empty-tags.js"
import { ERBNoExtraNewLineRule } from "./rules/erb-no-extra-newline.js"
import { ERBNoExtraWhitespaceRule } from "./rules/erb-no-extra-whitespace-inside-tags.js"
import { ERBNoInlineCaseConditionsRule } from "./rules/erb-no-inline-case-conditions.js"
import { ERBNoInstanceVariablesInPartialsRule } from "./rules/erb-no-instance-variables-in-partials.js"
import { ERBNoInterpolatedClassNamesRule } from "./rules/erb-no-interpolated-class-names.js"
import { ERBNoJavascriptTagHelperRule } from "./rules/erb-no-javascript-tag-helper.js"
import { ERBNoOutputControlFlowRule } from "./rules/erb-no-output-control-flow.js"
import { ERBNoOutputInAttributeNameRule } from "./rules/erb-no-output-in-attribute-name.js"
import { ERBNoOutputInAttributePositionRule } from "./rules/erb-no-output-in-attribute-position.js"
import { ERBNoRawOutputInAttributeValueRule } from "./rules/erb-no-raw-output-in-attribute-value.js"
import { ERBNoSilentStatementRule } from "./rules/erb-no-silent-statement.js"
import { ERBNoSilentTagInAttributeNameRule } from "./rules/erb-no-silent-tag-in-attribute-name.js"
import { ERBNoStatementInScriptRule } from "./rules/erb-no-statement-in-script.js"
import { ERBNoThenInControlFlowRule } from "./rules/erb-no-then-in-control-flow.js"
import { ERBNoTrailingWhitespaceRule } from "./rules/erb-no-trailing-whitespace.js"
import { ERBNoUnsafeJSAttributeRule } from "./rules/erb-no-unsafe-js-attribute.js"
import { ERBNoUnsafeRawRule } from "./rules/erb-no-unsafe-raw.js"
import { ERBNoUnsafeScriptInterpolationRule } from "./rules/erb-no-unsafe-script-interpolation.js"
import { ERBPreferImageTagHelperRule } from "./rules/erb-prefer-image-tag-helper.js"
import { ERBRequireTrailingNewlineRule } from "./rules/erb-require-trailing-newline.js"
import { ERBRequireWhitespaceRule } from "./rules/erb-require-whitespace-inside-tags.js"
import { ERBRightTrimRule } from "./rules/erb-right-trim.js"
import { ERBStrictLocalsCommentSyntaxRule } from "./rules/erb-strict-locals-comment-syntax.js"
import { ERBStrictLocalsRequiredRule } from "./rules/erb-strict-locals-required.js"

import { HerbDisableCommentMalformedRule } from "./rules/herb-disable-comment-malformed.js"
import { HerbDisableCommentMissingRulesRule } from "./rules/herb-disable-comment-missing-rules.js"
import { HerbDisableCommentNoDuplicateRulesRule } from "./rules/herb-disable-comment-no-duplicate-rules.js"
import { HerbDisableCommentNoRedundantAllRule } from "./rules/herb-disable-comment-no-redundant-all.js"
import { HerbDisableCommentUnnecessaryRule } from "./rules/herb-disable-comment-unnecessary.js"
import { HerbDisableCommentValidRuleNameRule } from "./rules/herb-disable-comment-valid-rule-name.js"

import { HTMLAllowedScriptTypeRule } from "./rules/html-allowed-script-type.js"
import { HTMLAttributeDoubleQuotesRule } from "./rules/html-attribute-double-quotes.js"
import { HTMLAttributeEqualsSpacingRule } from "./rules/html-attribute-equals-spacing.js"
import { HTMLAttributeValuesRequireQuotesRule } from "./rules/html-attribute-values-require-quotes.js"
import { HTMLBodyOnlyElementsRule } from "./rules/html-body-only-elements.js"
import { HTMLBooleanAttributesNoValueRule } from "./rules/html-boolean-attributes-no-value.js"
import { HTMLDetailsHasSummaryRule } from "./rules/html-details-has-summary.js"
import { HTMLHeadOnlyElementsRule } from "./rules/html-head-only-elements.js"
import { HTMLNoBlockInsideInlineRule } from "./rules/html-no-block-inside-inline.js"
import { HTMLNoDuplicateAttributesRule } from "./rules/html-no-duplicate-attributes.js"
import { HTMLNoDuplicateIdsRule } from "./rules/html-no-duplicate-ids.js"
import { HTMLNoDuplicateMetaNamesRule } from "./rules/html-no-duplicate-meta-names.js"
import { HTMLNoEmptyAttributesRule } from "./rules/html-no-empty-attributes.js"
import { HTMLNoSelfClosingRule } from "./rules/html-no-self-closing.js"
import { HTMLNoSpaceInTagRule } from "./rules/html-no-space-in-tag.js"
import { HTMLNoUnderscoresInAttributeNamesRule } from "./rules/html-no-underscores-in-attribute-names.js"
import { HTMLRequireClosingTagsRule } from "./rules/html-require-closing-tags.js"
import { HTMLRequireScriptNonceRule } from "./rules/html-require-script-nonce.js"
import { HTMLTagNameLowercaseRule } from "./rules/html-tag-name-lowercase.js"

import { ParserNoErrorsRule } from "./rules/parser-no-errors.js"

import { SVGTagNameCapitalizationRule } from "./rules/svg-tag-name-capitalization.js"

import { TurboPermanentRequireIdRule } from "./rules/turbo-permanent-require-id.js"

export const rules: RuleClass[] = [
  A11yAnchorRequireHrefRule,
  A11yAriaAttributeMustBeValid,
  A11yAriaLabelIsWellFormattedRule,
  A11yAriaLevelMustBeValidRule,
  A11yAriaRoleHeadingRequiresLevelRule,
  A11yAriaRoleMustBeValidRule,
  A11yAvoidBothDisabledAndAriaDisabledRule,
  A11yIframeHasTitleRule,
  A11yImgRequireAltRule,
  A11yInputRequireAutocompleteRule,
  A11yNavigationHasLabelRule,
  A11yNoAbstractRolesRule,
  A11yNoAriaHiddenOnBodyRule,
  A11yNoAriaHiddenOnFocusableRule,
  A11yNoEmptyHeadingsRule,
  A11yNoNestedLinksRule,
  A11yNoPositiveTabIndexRule,
  A11yNoTitleAttributeRule,

  ActionViewNoSilentHelperRule,
  ActionViewNoSilentRenderRule,
  ActionViewNoVoidElementContentRule,

  ERBCommentSyntax,
  ERBNoCaseNodeChildrenRule,
  ERBNoEmptyControlFlowRule,
  ERBNoConditionalHTMLElementRule,
  ERBNoConditionalOpenTagRule,
  ERBNoDuplicateBranchElementsRule,
  ERBNoEmptyTagsRule,
  ERBNoExtraNewLineRule,
  ERBNoExtraWhitespaceRule,
  ERBNoInlineCaseConditionsRule,
  ERBNoInstanceVariablesInPartialsRule,
  ERBNoInterpolatedClassNamesRule,
  ERBNoJavascriptTagHelperRule,
  ERBNoOutputControlFlowRule,
  ERBNoOutputInAttributeNameRule,
  ERBNoOutputInAttributePositionRule,
  ERBNoRawOutputInAttributeValueRule,
  ERBNoSilentStatementRule,
  ERBNoSilentTagInAttributeNameRule,
  ERBNoStatementInScriptRule,
  ERBNoThenInControlFlowRule,
  ERBNoTrailingWhitespaceRule,
  ERBNoUnsafeJSAttributeRule,
  ERBNoUnsafeRawRule,
  ERBNoUnsafeScriptInterpolationRule,
  ERBPreferImageTagHelperRule,
  ERBRequireTrailingNewlineRule,
  ERBRequireWhitespaceRule,
  ERBRightTrimRule,
  ERBStrictLocalsCommentSyntaxRule,
  ERBStrictLocalsRequiredRule,

  HerbDisableCommentMalformedRule,
  HerbDisableCommentMissingRulesRule,
  HerbDisableCommentNoDuplicateRulesRule,
  HerbDisableCommentNoRedundantAllRule,
  HerbDisableCommentUnnecessaryRule,
  HerbDisableCommentValidRuleNameRule,

  HTMLAllowedScriptTypeRule,
  HTMLAttributeDoubleQuotesRule,
  HTMLAttributeEqualsSpacingRule,
  HTMLAttributeValuesRequireQuotesRule,
  HTMLBodyOnlyElementsRule,
  HTMLBooleanAttributesNoValueRule,
  HTMLDetailsHasSummaryRule,
  HTMLHeadOnlyElementsRule,
  HTMLNoBlockInsideInlineRule,
  HTMLNoDuplicateAttributesRule,
  HTMLNoDuplicateIdsRule,
  HTMLNoDuplicateMetaNamesRule,
  HTMLNoEmptyAttributesRule,
  HTMLNoSelfClosingRule,
  HTMLNoSpaceInTagRule,
  HTMLNoUnderscoresInAttributeNamesRule,
  HTMLRequireClosingTagsRule,
  HTMLRequireScriptNonceRule,
  HTMLTagNameLowercaseRule,

  ParserNoErrorsRule,

  SVGTagNameCapitalizationRule,

  TurboPermanentRequireIdRule,
]
