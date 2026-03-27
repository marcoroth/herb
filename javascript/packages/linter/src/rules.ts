import type { RuleClass } from "./types.js"

import { A11yNoAutofocusAttributeRule } from "./rules/a11y-no-autofocus-attribute.js"

import { ActionViewNoSilentHelperRule } from "./rules/actionview-no-silent-helper.js"
import { ActionViewNoSilentRenderRule } from "./rules/actionview-no-silent-render.js"
import { ActionViewNoUnnecessaryTagAttributesRule } from "./rules/actionview-no-unnecessary-tag-attributes.js"
import { ActionViewNoVoidElementContentRule } from "./rules/actionview-no-void-element-content.js"
import { ActionViewStrictLocalsFirstLineRule } from "./rules/actionview-strict-locals-first-line.js"
import { ActionViewStrictLocalsPartialOnlyRule } from "./rules/actionview-strict-locals-partial-only.js"

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
import { HTMLDetailsHasSummaryRule } from "./rules/html-details-has-summary.js"
import { HTMLHeadOnlyElementsRule } from "./rules/html-head-only-elements.js"
import { HTMLIframeHasTitleRule } from "./rules/html-iframe-has-title.js"
import { HTMLImgRequireAltRule } from "./rules/html-img-require-alt.js"
import { HTMLInputRequireAutocompleteRule } from "./rules/html-input-require-autocomplete.js"
import { HTMLNavigationHasLabelRule } from "./rules/html-navigation-has-label.js"
import { HTMLNoAbstractRolesRule } from "./rules/html-no-abstract-roles.js"
import { HTMLNoAriaHiddenOnBodyRule } from "./rules/html-no-aria-hidden-on-body.js"
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
import { HTMLNoUnknownTagRule } from "./rules/html-no-unknown-tag.js"
import { HTMLNoSpaceInTagRule } from "./rules/html-no-space-in-tag.js"
import { HTMLNoTitleAttributeRule } from "./rules/html-no-title-attribute.js"
import { HTMLNoUnderscoresInAttributeNamesRule } from "./rules/html-no-underscores-in-attribute-names.js"
import { HTMLRequireClosingTagsRule } from "./rules/html-require-closing-tags.js"
import { HTMLRequireScriptNonceRule } from "./rules/html-require-script-nonce.js"
import { HTMLTagNameLowercaseRule } from "./rules/html-tag-name-lowercase.js"

import { ParserNoErrorsRule } from "./rules/parser-no-errors.js"

import { SourceIndentationRule } from "./rules/source-indentation.js"

import { SVGTagNameCapitalizationRule } from "./rules/svg-tag-name-capitalization.js"

import { TurboPermanentRequireIdRule } from "./rules/turbo-permanent-require-id.js"

export const rules: RuleClass[] = [
  A11yNoAutofocusAttributeRule,

  ActionViewNoSilentHelperRule,
  ActionViewNoSilentRenderRule,
  ActionViewNoUnnecessaryTagAttributesRule,
  ActionViewNoVoidElementContentRule,
  ActionViewStrictLocalsFirstLineRule,
  ActionViewStrictLocalsPartialOnlyRule,

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
  HTMLDetailsHasSummaryRule,
  HTMLHeadOnlyElementsRule,
  HTMLIframeHasTitleRule,
  HTMLImgRequireAltRule,
  HTMLInputRequireAutocompleteRule,
  HTMLNavigationHasLabelRule,
  HTMLNoAbstractRolesRule,
  HTMLNoAriaHiddenOnBodyRule,
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
  HTMLNoUnknownTagRule,
  HTMLNoSpaceInTagRule,
  HTMLNoTitleAttributeRule,
  HTMLNoUnderscoresInAttributeNamesRule,
  HTMLRequireClosingTagsRule,
  HTMLRequireScriptNonceRule,
  HTMLTagNameLowercaseRule,

  ParserNoErrorsRule,

  SourceIndentationRule,

  SVGTagNameCapitalizationRule,

  TurboPermanentRequireIdRule,
]
