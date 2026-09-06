import type { RuleClass } from "./types.js"

import { A11yAvoidGenericLinkTextRule } from "./rules/a11y-avoid-generic-link-text.js"
import { A11yDisabledAttributeRule } from "./rules/a11y-disabled-attribute.js"
import { A11yNestedInteractiveElementsRule } from "./rules/a11y-nested-interactive-elements.js"
import { A11yNoAccesskeyAttributeRule } from "./rules/a11y-no-accesskey-attribute.js"
import { A11yNoAriaLabelMisuseRule } from "./rules/a11y-no-aria-label-misuse.js"
import { A11yNoAriaUnsupportedElementsRule } from "./rules/a11y-no-aria-unsupported-elements.js"
import { A11yNoAutofocusAttributeRule } from "./rules/a11y-no-autofocus-attribute.js"
import { A11yNoRedundantImageAltRule } from "./rules/a11y-no-redundant-image-alt.js"
import { A11yNoVisuallyHiddenInteractiveElementsRule } from "./rules/a11y-no-visually-hidden-interactive-elements.js"
import { A11ySVGHasAccessibleTextRule } from "./rules/a11y-svg-has-accessible-text.js"

import { ActionViewNoContentArgumentWithBlockRule } from "./rules/actionview-no-content-argument-with-block.js"
import { ActionViewNoDynamicPartialPathRule } from "./rules/actionview-no-dynamic-partial-path.js"
import { ActionViewNoHelperShadowingRule } from "./rules/actionview-no-helper-shadowing.js"
import { ActionViewNoImplicitPartialRule } from "./rules/actionview-no-implicit-partial.js"
import { ActionViewNoImplicitPolymorphicURLRule } from "./rules/actionview-no-implicit-polymorphic-url.js"
import { ActionViewNoMistypedLocalsRule } from "./rules/actionview-no-mistyped-locals.js"
import { ActionViewNoRedundantLocalAssignsRule } from "./rules/actionview-no-redundant-local-assigns.js"
import { ActionViewNoRenderOptionShadowingRule } from "./rules/actionview-no-render-option-shadowing.js"
import { ActionViewNoSilentHelperRule } from "./rules/actionview-no-silent-helper.js"
import { ActionViewNoSilentRenderRule } from "./rules/actionview-no-silent-render.js"
import { ActionViewNoStrictLocalsErrorRule } from "./rules/actionview-no-strict-locals-error.js"
import { ActionViewNoUnnecessaryHTMLSafeRule } from "./rules/actionview-no-unnecessary-html-safe.js"
import { ActionViewNoUnnecessaryTagAttributesRule } from "./rules/actionview-no-unnecessary-tag-attributes.js"
import { ActionViewNoUnusedStrictLocalsRule } from "./rules/actionview-no-unused-strict-locals.js"
import { ActionViewNoVoidElementContentRule } from "./rules/actionview-no-void-element-content.js"
import { ActionViewPreferCollectionRenderRule } from "./rules/actionview-prefer-collection-render.js"
import { ActionViewPreferLinkToHelperRule } from "./rules/actionview-prefer-link-to-helper.js"
import { ActionViewPreferPluralizeHelperRule } from "./rules/actionview-prefer-pluralize-helper.js"
import { ActionViewPreferQualifiedPartialPathRule } from "./rules/actionview-prefer-qualified-partial-path.js"
import { ActionViewStrictLocalsFirstLineRule } from "./rules/actionview-strict-locals-first-line.js"
import { ActionViewStrictLocalsPartialOnlyRule } from "./rules/actionview-strict-locals-partial-only.js"

import { ERBCommentSyntax } from "./rules/erb-comment-syntax.js"
import { ERBNoByteOrderMarkRule } from "./rules/erb-no-byte-order-mark.js"
import { ERBNoCaseNodeChildrenRule } from "./rules/erb-no-case-node-children.js"
import { ERBNoClassDefinitionsRule } from "./rules/erb-no-class-definitions.js"
import { ERBNoCommentedOutOutputTagsRule } from "./rules/erb-no-commented-out-output-tags.js"
import { ERBNoConditionalHTMLElementRule } from "./rules/erb-no-conditional-html-element.js"
import { ERBNoConditionalOpenTagRule } from "./rules/erb-no-conditional-open-tag.js"
import { ERBNoDebugOutputRule } from "./rules/erb-no-debug-output.js"
import { ERBNoDuplicateBranchElementsRule } from "./rules/erb-no-duplicate-branch-elements.js"
import { ERBNoEmptyControlFlowRule } from "./rules/erb-no-empty-control-flow.js"
import { ERBNoEmptyTagsRule } from "./rules/erb-no-empty-tags.js"
import { ERBNoExtraNewLineRule } from "./rules/erb-no-extra-newline.js"
import { ERBNoExtraWhitespaceRule } from "./rules/erb-no-extra-whitespace-inside-tags.js"
import { ERBNoInlineCaseConditionsRule } from "./rules/erb-no-inline-case-conditions.js"
import { ERBNoInstanceVariablesInPartialsRule } from "./rules/erb-no-instance-variables-in-partials.js"
import { ERBNoInterpolatedClassNamesRule } from "./rules/erb-no-interpolated-class-names.js"
import { ERBNoJavascriptTagHelperRule } from "./rules/erb-no-javascript-tag-helper.js"
import { ERBNoMethodDefinitionsRule } from "./rules/erb-no-method-definitions.js"
import { ERBNoModuleDefinitionsRule } from "./rules/erb-no-module-definitions.js"
import { ERBNoOutputControlFlowRule } from "./rules/erb-no-output-control-flow.js"
import { ERBNoOutputInAttributeNameRule } from "./rules/erb-no-output-in-attribute-name.js"
import { ERBNoOutputInAttributePositionRule } from "./rules/erb-no-output-in-attribute-position.js"
import { ERBNoRawOutputInAttributeValueRule } from "./rules/erb-no-raw-output-in-attribute-value.js"
import { ERBNoReturnRule } from "./rules/erb-no-return.js"
import { ERBNoShadowedBlockArgumentRule } from "./rules/erb-no-shadowed-block-argument.js"
import { ERBNoSilentStatementRule } from "./rules/erb-no-silent-statement.js"
import { ERBNoSilentTagInAttributeNameRule } from "./rules/erb-no-silent-tag-in-attribute-name.js"
import { ERBNoSleepRule } from "./rules/erb-no-sleep.js"
import { ERBNoStatementInScriptRule } from "./rules/erb-no-statement-in-script.js"
import { ERBNoThenInControlFlowRule } from "./rules/erb-no-then-in-control-flow.js"
import { ERBNoTrailingWhitespaceRule } from "./rules/erb-no-trailing-whitespace.js"
import { ERBNoUnsafeJSAttributeRule } from "./rules/erb-no-unsafe-js-attribute.js"
import { ERBNoUnsafeRawRule } from "./rules/erb-no-unsafe-raw.js"
import { ERBNoUnsafeScriptInterpolationRule } from "./rules/erb-no-unsafe-script-interpolation.js"
import { ERBNoUnusedBlockArgumentRule } from "./rules/erb-no-unused-block-argument.js"
import { ERBNoUnusedExpressionsRule } from "./rules/erb-no-unused-expressions.js"
import { ERBNoUnusedLiteralsRule } from "./rules/erb-no-unused-literals.js"
import { ERBNoUnusedLocalVariableRule } from "./rules/erb-no-unused-local-variable.js"
import { ERBPreferDirectOutputRule } from "./rules/erb-prefer-direct-output.js"
import { ERBPreferDoEndBlocksRule } from "./rules/erb-prefer-do-end-blocks.js"
import { ERBPreferEachOverMapRule } from "./rules/erb-prefer-each-over-map.js"
import { ERBPreferExplicitConditionalsRule } from "./rules/erb-prefer-explicit-conditionals.js"
import { ERBPreferImageTagHelperRule } from "./rules/erb-prefer-image-tag-helper.js"
import { ERBRequireTrailingNewlineRule } from "./rules/erb-require-trailing-newline.js"
import { ERBRequireWhitespaceRule } from "./rules/erb-require-whitespace-inside-tags.js"
import { ERBRightTrimRule } from "./rules/erb-right-trim.js"
import { ERBStrictLocalsCommentSyntaxRule } from "./rules/erb-strict-locals-comment-syntax.js"
import { ERBStrictLocalsRequiredRule } from "./rules/erb-strict-locals-required.js"

import { HerbComponentRequiresSlotsRule } from "./rules/herb-component-requires-slots.js"
import { HerbConfigFrameworkOptionRule } from "./rules/herb-config-framework-option.js"
import { HerbDisableCommentMalformedRule } from "./rules/herb-disable-comment-malformed.js"
import { HerbDisableCommentMissingRulesRule } from "./rules/herb-disable-comment-missing-rules.js"
import { HerbDisableCommentNoDuplicateRulesRule } from "./rules/herb-disable-comment-no-duplicate-rules.js"
import { HerbDisableCommentNoRedundantAllRule } from "./rules/herb-disable-comment-no-redundant-all.js"
import { HerbDisableCommentUnnecessaryRule } from "./rules/herb-disable-comment-unnecessary.js"
import { HerbDisableCommentValidRuleNameRule } from "./rules/herb-disable-comment-valid-rule-name.js"
import { HerbIntoRequiresCollectionRule } from "./rules/herb-into-requires-collection.js"
import { HerbSlotsValidComponentsRule } from "./rules/herb-slots-valid-components.js"
import { HerbSlotsValidModeRule } from "./rules/herb-slots-valid-mode.js"
import { HerbStateNoSilentReadsRule } from "./rules/herb-state-no-silent-reads.js"
import { HerbStateNoServerWritesRule } from "./rules/herb-state-no-server-writes.js"
import { HerbStateNoShadowedStatesRule } from "./rules/herb-state-no-shadowed-states.js"
import { HerbStateNoUnusedStatesRule } from "./rules/herb-state-no-unused-states.js"
import { HerbStateRequiresSlotsRule } from "./rules/herb-state-requires-slots.js"
import { HerbStateValidActionsRule } from "./rules/herb-state-valid-actions.js"
import { HerbStateValidBindingsRule } from "./rules/herb-state-valid-bindings.js"
import { HerbScopedStyleNoUnusedSelectorRule } from "./rules/herb-scoped-style-no-unused-selector.js"
import { HerbScopedStyleRequireTopLevelRule } from "./rules/herb-scoped-style-require-top-level.js"
import { HerbScopedStyleSingleDeclarationRule } from "./rules/herb-scoped-style-single-declaration.js"
import { HerbStateDirectiveSyntaxRule } from "./rules/herb-state-directive-syntax.js"
import { HerbStateSingleDeclarationRule } from "./rules/herb-state-single-declaration.js"
import { HerbStateValidDeclarationRule } from "./rules/herb-state-valid-declaration.js"
import { HerbStateValidReadsRule } from "./rules/herb-state-valid-reads.js"
import { HerbValidSlotNamesRule } from "./rules/herb-valid-slot-names.js"

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
import { HTMLNoEmptyCSSRuleRule } from "./rules/html-no-empty-css-rule.js"
import { HTMLNoEmptyHeadingsRule } from "./rules/html-no-empty-headings.js"
import { HTMLNoEventHandlerAttributesRule } from "./rules/html-no-event-handler-attributes.js"
import { HTMLNoInlineScriptElementsRule } from "./rules/html-no-inline-script-elements.js"
import { HTMLNoLiteralNBSPRule } from "./rules/html-no-literal-nbsp.js"
import { HTMLNoNestedFormsRule } from "./rules/html-no-nested-forms.js"
import { HTMLNoNestedLinksRule } from "./rules/html-no-nested-links.js"
import { HTMLNoPositiveTabIndexRule } from "./rules/html-no-positive-tab-index.js"
import { HTMLNoSelfClosingRule } from "./rules/html-no-self-closing.js"
import { HTMLNoSpaceInTagRule } from "./rules/html-no-space-in-tag.js"
import { HTMLNoStyleAttributesRule } from "./rules/html-no-style-attributes.js"
import { HTMLNoStyleElementsRule } from "./rules/html-no-style-elements.js"
import { HTMLNoTitleAttributeRule } from "./rules/html-no-title-attribute.js"
import { HTMLNoUnderscoresInAttributeNamesRule } from "./rules/html-no-underscores-in-attribute-names.js"
import { HTMLNoUnescapedEntitiesRule } from "./rules/html-no-unescaped-entities.js"
import { HTMLNoUnknownTagRule } from "./rules/html-no-unknown-tag.js"
import { HTMLRequireClosingTagsRule } from "./rules/html-require-closing-tags.js"
import { HTMLRequireScriptNonceRule } from "./rules/html-require-script-nonce.js"
import { HTMLTagNameLowercaseRule } from "./rules/html-tag-name-lowercase.js"

import { ParserNoErrorsRule } from "./rules/parser-no-errors.js"

import { SourceIndentationRule } from "./rules/source-indentation.js"

import { SVGNoDeprecatedTagsRule } from "./rules/svg-no-deprecated-tags.js"
import { SVGTagNameCapitalizationRule } from "./rules/svg-tag-name-capitalization.js"

import { TurboPermanentNoMisleadingValueRule } from "./rules/turbo-permanent-no-misleading-value.js"
import { TurboPermanentRequireIdRule } from "./rules/turbo-permanent-require-id.js"

import { UJSNoRemoteAttributeRule } from "./rules/ujs-no-remote-attribute.js"
import { UJSPreferTurboConfirmRule } from "./rules/ujs-prefer-turbo-confirm.js"
import { UJSPreferTurboMethodRule } from "./rules/ujs-prefer-turbo-method.js"
import { UJSPreferTurboSubmitsWithRule } from "./rules/ujs-prefer-turbo-submits-with.js"

export const rules: RuleClass[] = [
  A11yAvoidGenericLinkTextRule,
  A11yDisabledAttributeRule,
  A11yNestedInteractiveElementsRule,
  A11yNoAccesskeyAttributeRule,
  A11yNoAriaLabelMisuseRule,
  A11yNoAriaUnsupportedElementsRule,
  A11yNoAutofocusAttributeRule,
  A11yNoRedundantImageAltRule,
  A11yNoVisuallyHiddenInteractiveElementsRule,
  A11ySVGHasAccessibleTextRule,

  ActionViewNoContentArgumentWithBlockRule,
  ActionViewNoDynamicPartialPathRule,
  ActionViewNoHelperShadowingRule,
  ActionViewNoImplicitPartialRule,
  ActionViewNoImplicitPolymorphicURLRule,
  ActionViewNoMistypedLocalsRule,
  ActionViewNoRedundantLocalAssignsRule,
  ActionViewNoRenderOptionShadowingRule,
  ActionViewNoSilentHelperRule,
  ActionViewNoSilentRenderRule,
  ActionViewNoStrictLocalsErrorRule,
  ActionViewNoUnnecessaryHTMLSafeRule,
  ActionViewNoUnnecessaryTagAttributesRule,
  ActionViewNoUnusedStrictLocalsRule,
  ActionViewNoVoidElementContentRule,
  ActionViewPreferCollectionRenderRule,
  ActionViewPreferLinkToHelperRule,
  ActionViewPreferPluralizeHelperRule,
  ActionViewPreferQualifiedPartialPathRule,
  ActionViewStrictLocalsFirstLineRule,
  ActionViewStrictLocalsPartialOnlyRule,

  ERBCommentSyntax,
  ERBNoByteOrderMarkRule,
  ERBNoCaseNodeChildrenRule,
  ERBNoClassDefinitionsRule,
  ERBNoCommentedOutOutputTagsRule,
  ERBNoConditionalHTMLElementRule,
  ERBNoConditionalOpenTagRule,
  ERBNoDebugOutputRule,
  ERBNoDuplicateBranchElementsRule,
  ERBNoEmptyControlFlowRule,
  ERBNoEmptyTagsRule,
  ERBNoExtraNewLineRule,
  ERBNoExtraWhitespaceRule,
  ERBNoInlineCaseConditionsRule,
  ERBNoInstanceVariablesInPartialsRule,
  ERBNoInterpolatedClassNamesRule,
  ERBNoJavascriptTagHelperRule,
  ERBNoMethodDefinitionsRule,
  ERBNoModuleDefinitionsRule,
  ERBNoOutputControlFlowRule,
  ERBNoOutputInAttributeNameRule,
  ERBNoOutputInAttributePositionRule,
  ERBNoRawOutputInAttributeValueRule,
  ERBNoReturnRule,
  ERBNoShadowedBlockArgumentRule,
  ERBNoSilentStatementRule,
  ERBNoSilentTagInAttributeNameRule,
  ERBNoSleepRule,
  ERBNoStatementInScriptRule,
  ERBNoThenInControlFlowRule,
  ERBNoTrailingWhitespaceRule,
  ERBNoUnsafeJSAttributeRule,
  ERBNoUnsafeRawRule,
  ERBNoUnsafeScriptInterpolationRule,
  ERBNoUnusedBlockArgumentRule,
  ERBNoUnusedExpressionsRule,
  ERBNoUnusedLiteralsRule,
  ERBNoUnusedLocalVariableRule,
  ERBPreferDirectOutputRule,
  ERBPreferDoEndBlocksRule,
  ERBPreferEachOverMapRule,
  ERBPreferExplicitConditionalsRule,
  ERBPreferImageTagHelperRule,
  ERBRequireTrailingNewlineRule,
  ERBRequireWhitespaceRule,
  ERBRightTrimRule,
  ERBStrictLocalsCommentSyntaxRule,
  ERBStrictLocalsRequiredRule,

  HerbComponentRequiresSlotsRule,
  HerbConfigFrameworkOptionRule,
  HerbDisableCommentMalformedRule,
  HerbDisableCommentMissingRulesRule,
  HerbDisableCommentNoDuplicateRulesRule,
  HerbDisableCommentNoRedundantAllRule,
  HerbDisableCommentUnnecessaryRule,
  HerbDisableCommentValidRuleNameRule,
  HerbIntoRequiresCollectionRule,
  HerbSlotsValidComponentsRule,
  HerbSlotsValidModeRule,
  HerbStateNoSilentReadsRule,
  HerbStateNoServerWritesRule,
  HerbStateNoShadowedStatesRule,
  HerbStateNoUnusedStatesRule,
  HerbStateRequiresSlotsRule,
  HerbStateValidActionsRule,
  HerbStateValidBindingsRule,
  HerbScopedStyleNoUnusedSelectorRule,
  HerbScopedStyleRequireTopLevelRule,
  HerbScopedStyleSingleDeclarationRule,
  HerbStateDirectiveSyntaxRule,
  HerbStateSingleDeclarationRule,
  HerbStateValidDeclarationRule,
  HerbStateValidReadsRule,
  HerbValidSlotNamesRule,

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
  HTMLNoEmptyCSSRuleRule,
  HTMLNoEmptyHeadingsRule,
  HTMLNoEventHandlerAttributesRule,
  HTMLNoInlineScriptElementsRule,
  HTMLNoLiteralNBSPRule,
  HTMLNoNestedFormsRule,
  HTMLNoNestedLinksRule,
  HTMLNoPositiveTabIndexRule,
  HTMLNoSelfClosingRule,
  HTMLNoSpaceInTagRule,
  HTMLNoStyleAttributesRule,
  HTMLNoStyleElementsRule,
  HTMLNoTitleAttributeRule,
  HTMLNoUnderscoresInAttributeNamesRule,
  HTMLNoUnescapedEntitiesRule,
  HTMLNoUnknownTagRule,
  HTMLRequireClosingTagsRule,
  HTMLRequireScriptNonceRule,
  HTMLTagNameLowercaseRule,

  ParserNoErrorsRule,

  SourceIndentationRule,

  SVGNoDeprecatedTagsRule,
  SVGTagNameCapitalizationRule,

  TurboPermanentNoMisleadingValueRule,
  TurboPermanentRequireIdRule,

  UJSNoRemoteAttributeRule,
  UJSPreferTurboConfirmRule,
  UJSPreferTurboMethodRule,
  UJSPreferTurboSubmitsWithRule,
]
