pub mod a11y_avoid_generic_link_text;
pub mod a11y_disabled_attribute;
pub mod a11y_nested_interactive_elements;
pub mod a11y_no_accesskey_attribute;
pub mod a11y_no_aria_label_misuse;
pub mod a11y_no_aria_unsupported_elements;
pub mod a11y_no_autofocus_attribute;
pub mod a11y_no_redundant_image_alt;
pub mod a11y_svg_has_accessible_text;
pub mod actionview_no_silent_helper;
pub mod actionview_no_silent_render;
pub mod actionview_no_unnecessary_tag_attributes;
pub mod actionview_no_void_element_content;
pub mod actionview_strict_locals_first_line;
pub mod actionview_strict_locals_partial_only;
pub mod erb_comment_syntax;
pub mod erb_no_case_node_children;
pub mod erb_no_conditional_html_element;
pub mod erb_no_conditional_open_tag;
pub mod erb_no_debug_output;
pub mod erb_no_duplicate_branch_elements;
pub mod erb_no_empty_control_flow;
pub mod erb_no_empty_tags;
pub mod erb_no_extra_newline;
pub mod erb_no_extra_whitespace_inside_tags;
pub mod erb_no_inline_case_conditions;
pub mod erb_no_instance_variables_in_partials;
pub mod erb_no_interpolated_class_names;
pub mod erb_no_javascript_tag_helper;
pub mod erb_no_output_control_flow;
pub mod erb_no_output_in_attribute_name;
pub mod erb_no_output_in_attribute_position;
pub mod erb_no_raw_output_in_attribute_value;
pub mod erb_no_silent_statement;
pub mod erb_no_silent_tag_in_attribute_name;
pub mod erb_no_statement_in_script;
pub mod erb_no_then_in_control_flow;
pub mod erb_no_trailing_whitespace;
pub mod erb_no_unsafe_js_attribute;
pub mod erb_no_unsafe_raw;
pub mod erb_no_unsafe_script_interpolation;
pub mod erb_no_unused_expressions;
pub mod erb_no_unused_literals;
pub mod erb_prefer_direct_output;
pub mod erb_prefer_image_tag_helper;
pub mod erb_require_trailing_newline;
pub mod erb_require_whitespace_inside_tags;
pub mod erb_right_trim;
pub mod erb_strict_locals_comment_syntax;
pub mod erb_strict_locals_required;
pub mod herb_disable_comment_malformed;
pub mod herb_disable_comment_missing_rules;
pub mod herb_disable_comment_no_duplicate_rules;
pub mod herb_disable_comment_no_redundant_all;
pub mod herb_disable_comment_unnecessary;
pub mod herb_disable_comment_valid_rule_name;
pub mod html_allowed_script_type;
pub mod html_anchor_require_href;
pub mod html_aria_attribute_must_be_valid;
pub mod html_aria_label_is_well_formatted;
pub mod html_aria_level_must_be_valid;
pub mod html_aria_role_heading_requires_level;
pub mod html_aria_role_must_be_valid;
pub mod html_attribute_double_quotes;
pub mod html_attribute_equals_spacing;
pub mod html_attribute_values_require_quotes;
pub mod html_avoid_both_disabled_and_aria_disabled;
pub mod html_body_only_elements;
pub mod html_boolean_attributes_no_value;
pub mod html_details_has_summary;
pub mod html_head_only_elements;
pub mod html_iframe_has_title;
pub mod html_img_require_alt;
pub mod html_input_require_autocomplete;
pub mod html_navigation_has_label;
pub mod html_no_abstract_roles;
pub mod html_no_aria_hidden_on_body;
pub mod html_no_aria_hidden_on_focusable;
pub mod html_no_block_inside_inline;
pub mod html_no_duplicate_attributes;
pub mod html_no_duplicate_ids;
pub mod html_no_duplicate_meta_names;
pub mod html_no_empty_attributes;
pub mod html_no_empty_headings;
pub mod html_no_nested_links;
pub mod html_no_positive_tab_index;
pub mod html_no_self_closing;
pub mod html_no_space_in_tag;
pub mod html_no_title_attribute;
pub mod html_no_underscores_in_attribute_names;
pub mod html_no_unescaped_entities;
pub mod html_no_unknown_tag;
pub mod html_require_closing_tags;
pub mod html_require_script_nonce;
pub mod html_tag_name_lowercase;
pub mod parser_no_errors;
pub mod source_indentation;
pub mod svg_tag_name_capitalization;
pub mod turbo_permanent_require_id;

use crate::rule::AnyRule;

macro_rules! parser_rule {
  ($rule:expr) => {
    AnyRule::Parser(Box::new($rule))
  };
}

macro_rules! source_rule {
  ($rule:expr) => {
    AnyRule::Source(Box::new($rule))
  };
}

pub fn all_rules() -> Vec<AnyRule> {
  vec![
    parser_rule!(parser_no_errors::ParserNoErrorsRule),
    parser_rule!(a11y_disabled_attribute::A11yDisabledAttributeRule),
    parser_rule!(a11y_no_accesskey_attribute::A11yNoAccesskeyAttributeRule),
    parser_rule!(a11y_no_aria_unsupported_elements::A11yNoAriaUnsupportedElementsRule),
    parser_rule!(erb_comment_syntax::ERBCommentSyntaxRule),
    parser_rule!(erb_no_case_node_children::ERBNoCaseNodeChildrenRule),
    parser_rule!(erb_no_conditional_html_element::ERBNoConditionalHTMLElementRule),
    parser_rule!(erb_no_conditional_open_tag::ERBNoConditionalOpenTagRule),
    parser_rule!(erb_no_empty_tags::ERBNoEmptyTagsRule),
    parser_rule!(erb_no_extra_whitespace_inside_tags::ERBNoExtraWhitespaceInsideTagsRule),
    parser_rule!(erb_no_output_control_flow::ERBNoOutputControlFlowRule),
    parser_rule!(erb_no_silent_tag_in_attribute_name::ERBNoSilentTagInAttributeNameRule),
    parser_rule!(erb_no_trailing_whitespace::ERBNoTrailingWhitespaceRule),
    parser_rule!(erb_prefer_image_tag_helper::ERBPreferImageTagHelperRule),
    parser_rule!(erb_require_whitespace_inside_tags::ERBRequireWhitespaceInsideTagsRule),
    parser_rule!(erb_right_trim::ERBRightTrimRule),
    parser_rule!(erb_strict_locals_comment_syntax::ERBStrictLocalsCommentSyntaxRule),
    parser_rule!(html_allowed_script_type::HTMLAllowedScriptTypeRule),
    parser_rule!(html_anchor_require_href::HTMLAnchorRequireHrefRule),
    parser_rule!(html_aria_attribute_must_be_valid::HTMLAriaAttributeMustBeValidRule),
    parser_rule!(html_aria_label_is_well_formatted::HTMLAriaLabelIsWellFormattedRule),
    parser_rule!(html_aria_level_must_be_valid::HTMLAriaLevelMustBeValidRule),
    parser_rule!(html_aria_role_heading_requires_level::HTMLAriaRoleHeadingRequiresLevelRule),
    parser_rule!(html_aria_role_must_be_valid::HTMLAriaRoleMustBeValidRule),
    parser_rule!(html_attribute_double_quotes::HTMLAttributeDoubleQuotesRule),
    parser_rule!(html_attribute_equals_spacing::HTMLAttributeEqualsSpacingRule),
    parser_rule!(html_attribute_values_require_quotes::HTMLAttributeValuesRequireQuotesRule),
    parser_rule!(html_avoid_both_disabled_and_aria_disabled::HTMLAvoidBothDisabledAndAriaDisabledRule),
    parser_rule!(html_body_only_elements::HTMLBodyOnlyElementsRule),
    parser_rule!(html_boolean_attributes_no_value::HTMLBooleanAttributesNoValueRule),
    parser_rule!(html_head_only_elements::HTMLHeadOnlyElementsRule),
    parser_rule!(html_iframe_has_title::HTMLIframeHasTitleRule),
    parser_rule!(html_img_require_alt::HTMLImgRequireAltRule),
    parser_rule!(html_input_require_autocomplete::HTMLInputRequireAutocompleteRule),
    parser_rule!(html_navigation_has_label::HTMLNavigationHasLabelRule),
    parser_rule!(html_no_abstract_roles::HTMLNoAbstractRolesRule),
    parser_rule!(html_no_aria_hidden_on_body::HTMLNoAriaHiddenOnBodyRule),
    parser_rule!(html_no_aria_hidden_on_focusable::HTMLNoAriaHiddenOnFocusableRule),
    parser_rule!(html_no_block_inside_inline::HTMLNoBlockInsideInlineRule),
    parser_rule!(html_no_duplicate_attributes::HTMLNoDuplicateAttributesRule),
    parser_rule!(html_no_duplicate_ids::HTMLNoDuplicateIdsRule),
    parser_rule!(html_no_duplicate_meta_names::HTMLNoDuplicateMetaNamesRule),
    parser_rule!(html_no_empty_attributes::HTMLNoEmptyAttributesRule),
    parser_rule!(html_no_empty_headings::HTMLNoEmptyHeadingsRule),
    parser_rule!(html_no_nested_links::HTMLNoNestedLinksRule),
    parser_rule!(html_no_positive_tab_index::HTMLNoPositiveTabIndexRule),
    parser_rule!(html_no_self_closing::HTMLNoSelfClosingRule),
    parser_rule!(html_no_space_in_tag::HTMLNoSpaceInTagRule),
    parser_rule!(html_no_title_attribute::HTMLNoTitleAttributeRule),
    parser_rule!(html_no_underscores_in_attribute_names::HTMLNoUnderscoresInAttributeNamesRule),
    parser_rule!(html_tag_name_lowercase::HTMLTagNameLowercaseRule),
    parser_rule!(svg_tag_name_capitalization::SVGTagNameCapitalizationRule),
    source_rule!(erb_no_extra_newline::ERBNoExtraNewlineRule),
    source_rule!(erb_require_trailing_newline::ERBRequireTrailingNewlineRule),
    parser_rule!(erb_strict_locals_required::ERBStrictLocalsRequiredRule),
    parser_rule!(herb_disable_comment_malformed::HerbDisableCommentMalformedRule),
    parser_rule!(herb_disable_comment_missing_rules::HerbDisableCommentMissingRulesRule),
    parser_rule!(herb_disable_comment_valid_rule_name::HerbDisableCommentValidRuleNameRule),
    parser_rule!(herb_disable_comment_no_redundant_all::HerbDisableCommentNoRedundantAllRule),
    parser_rule!(herb_disable_comment_no_duplicate_rules::HerbDisableCommentNoDuplicateRulesRule),
    parser_rule!(herb_disable_comment_unnecessary::HerbDisableCommentUnnecessaryRule),
    parser_rule!(a11y_svg_has_accessible_text::A11ySVGHasAccessibleTextRule),
    parser_rule!(a11y_no_redundant_image_alt::A11yNoRedundantImageAltRule),
    parser_rule!(a11y_avoid_generic_link_text::A11yAvoidGenericLinkTextRule),
    parser_rule!(a11y_nested_interactive_elements::A11yNestedInteractiveElementsRule),
    parser_rule!(a11y_no_aria_label_misuse::A11yNoAriaLabelMisuseRule),
    parser_rule!(html_require_closing_tags::HTMLRequireClosingTagsRule),
    parser_rule!(turbo_permanent_require_id::TurboPermanentRequireIdRule),
    parser_rule!(erb_no_inline_case_conditions::ERBNoInlineCaseConditionsRule),
    parser_rule!(erb_no_then_in_control_flow::ERBNoThenInControlFlowRule),
    parser_rule!(html_details_has_summary::HTMLDetailsHasSummaryRule),
    parser_rule!(erb_no_javascript_tag_helper::ERBNoJavascriptTagHelperRule),
    parser_rule!(erb_no_output_in_attribute_name::ERBNoOutputInAttributeNameRule),
    parser_rule!(erb_no_statement_in_script::ERBNoStatementInScriptRule),
    parser_rule!(erb_no_raw_output_in_attribute_value::ERBNoRawOutputInAttributeValueRule),
    parser_rule!(erb_no_unsafe_js_attribute::ERBNoUnsafeJSAttributeRule),
    parser_rule!(actionview_no_void_element_content::ActionViewNoVoidElementContentRule),
    parser_rule!(actionview_no_silent_render::ActionViewNoSilentRenderRule),
    parser_rule!(erb_no_unsafe_raw::ERBNoUnsafeRawRule),
    parser_rule!(erb_no_interpolated_class_names::ERBNoInterpolatedClassNamesRule),
    parser_rule!(actionview_strict_locals_partial_only::ActionViewStrictLocalsPartialOnlyRule),
    source_rule!(source_indentation::SourceIndentationRule),
    parser_rule!(html_no_unknown_tag::HTMLNoUnknownTagRule),
    parser_rule!(html_require_script_nonce::HTMLRequireScriptNonceRule),
    parser_rule!(actionview_strict_locals_first_line::ActionViewStrictLocalsFirstLineRule),
    parser_rule!(html_no_unescaped_entities::HTMLNoUnescapedEntitiesRule),
    parser_rule!(erb_no_empty_control_flow::ERBNoEmptyControlFlowRule),
    parser_rule!(erb_no_duplicate_branch_elements::ERBNoDuplicateBranchElementsRule),
    parser_rule!(erb_no_silent_statement::ERBNoSilentStatementRule),
    parser_rule!(erb_no_debug_output::ERBNoDebugOutputRule),
    parser_rule!(erb_no_output_in_attribute_position::ERBNoOutputInAttributePositionRule),
    parser_rule!(a11y_no_autofocus_attribute::A11yNoAutofocusAttributeRule),
    parser_rule!(actionview_no_unnecessary_tag_attributes::ActionViewNoUnnecessaryTagAttributesRule),
    parser_rule!(erb_no_instance_variables_in_partials::ERBNoInstanceVariablesInPartialsRule),
    parser_rule!(actionview_no_silent_helper::ActionViewNoSilentHelperRule),
    parser_rule!(erb_prefer_direct_output::ERBPreferDirectOutputRule),
    parser_rule!(erb_no_unsafe_script_interpolation::ERBNoUnsafeScriptInterpolationRule),
    parser_rule!(erb_no_unused_literals::ERBNoUnusedLiteralsRule),
    parser_rule!(erb_no_unused_expressions::ERBNoUnusedExpressionsRule),
  ]
}
