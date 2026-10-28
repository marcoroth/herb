#include <prism.h>
#include <prism/internal/diagnostic.h>
#include <stdbool.h>
#include <string.h>

#include "../include/analyze/action_view/tag_helper_node_builders.h"
#include "../include/analyze/action_view/tag_helpers.h"
#include "../include/analyze/analyzed_ruby.h"
#include "../include/analyze/helpers.h"
#include "../include/ast/ast_nodes.h"
#include "../include/lexer/token.h"
#include "../include/lib/hb_array.h"
#include "../include/lib/string.h"
#include "../include/prism/prism_helpers.h"

bool has_if_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->if_node_count > 0;
}

bool has_elsif_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->elsif_node_count > 0;
}

bool has_else_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->else_node_count > 0;
}

bool has_end(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->end_count > 0;
}

bool has_block_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->block_node_count > 0;
}

bool has_block_closing(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->block_closing_count > 0;
}

bool has_case_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->case_node_count > 0;
}

bool has_case_match_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->case_match_node_count > 0;
}

bool has_when_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->when_node_count > 0;
}

bool has_in_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->in_node_count > 0;
}

bool has_for_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->for_node_count > 0;
}

bool has_while_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->while_node_count > 0;
}

bool has_until_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->until_node_count > 0;
}

bool has_begin_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->begin_node_count > 0;
}

bool has_rescue_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->rescue_node_count > 0;
}

bool has_ensure_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->ensure_node_count > 0;
}

bool has_unless_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->unless_node_count > 0;
}

bool has_yield_node(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->yield_node_count > 0;
}

bool has_then_keyword(analyzed_ruby_T* analyzed) {
  return analyzed && analyzed->then_keyword_count > 0;
}

bool has_inline_case_condition(analyzed_ruby_T* analyzed) {
  return (has_case_node(analyzed) && has_when_node(analyzed))
      || (has_case_match_node(analyzed) && has_in_node(analyzed));
}

typedef struct {
  uint32_t offset;
  bool found;
} inline_condition_offset_T;

static pm_visit_result_t search_inline_condition_offset(const pm_node_t* node, void* data) {
  inline_condition_offset_T* context = (inline_condition_offset_T*) data;

  uint32_t keyword_offset = UINT32_MAX;

  if (node->type == PM_WHEN_NODE) {
    keyword_offset = ((const pm_when_node_t*) node)->when_keyword_loc.start;
  } else if (node->type == PM_IN_NODE) {
    keyword_offset = ((const pm_in_node_t*) node)->in_keyword_loc.start;
  } else if (node->type == PM_MATCH_PREDICATE_NODE) {
    keyword_offset = ((const pm_match_predicate_node_t*) node)->keyword_loc.start;
  }

  if (keyword_offset != UINT32_MAX && (!context->found || keyword_offset < context->offset)) {
    context->offset = keyword_offset;
    context->found = true;
  }

  pm_visit_child_nodes(node, search_inline_condition_offset, context);

  return PM_VISIT_SKIP;
}

static hb_string_T control_continuation_keywords[] = HB_STRING_LIST("else", "elsif", "when", "in", "rescue", "ensure");
static hb_string_T control_terminator_keywords[] = HB_STRING_LIST("end", "}");

static bool matches_keyword(hb_string_T keyword, const hb_string_T* keywords, size_t count) {
  for (size_t index = 0; index < count; index++) {
    if (hb_string_equals(keyword, keywords[index])) { return true; }
  }

  return false;
}

static bool is_control_continuation_keyword(hb_string_T keyword) {
  return matches_keyword(
    keyword,
    control_continuation_keywords,
    sizeof(control_continuation_keywords) / sizeof(control_continuation_keywords[0])
  );
}

static bool is_control_role_keyword(hb_string_T keyword) {
  return is_control_continuation_keyword(keyword)
      || matches_keyword(
           keyword,
           control_terminator_keywords,
           sizeof(control_terminator_keywords) / sizeof(control_terminator_keywords[0])
      );
}

bool control_role_split_offset(const analyzed_ruby_T* analyzed, uint32_t* offset) {
  if (!analyzed || !offset) { return false; }

  uint32_t first = UINT32_MAX;
  uint32_t second = UINT32_MAX;
  bool first_continues = false;

  const uint8_t* source = pm_parser_start(analyzed->parser);

  for (const pm_diagnostic_t* diagnostic = pm_parser_errors_first(analyzed->parser); diagnostic != NULL;
       diagnostic = pm_diagnostic_next(diagnostic)) {
    if (diagnostic->diag_id != PM_ERR_UNEXPECTED_TOKEN_IGNORE) { continue; }

    hb_string_T keyword =
      hb_string_from_data((const char*) (source + diagnostic->location.start), diagnostic->location.length);

    if (!is_control_role_keyword(keyword)) { continue; }

    uint32_t start = diagnostic->location.start;

    if (start < first) {
      second = first;
      first = start;
      first_continues = is_control_continuation_keyword(keyword);
    } else if (start < second) {
      second = start;
    }
  }

  if (second == UINT32_MAX) { return false; }
  if (!first_continues) { return false; }

  *offset = second;

  return true;
}

bool has_inline_pattern_match(analyzed_ruby_T* analyzed, hb_string_T content) {
  if (!has_case_match_node(analyzed) || !has_in_node(analyzed)) { return false; }

  uint32_t offset = 0;

  if (!inline_condition_keyword_offset(analyzed, &offset)) { return false; }
  if (offset > content.length) { return false; }

  return memchr(content.data, '\n', offset) == NULL;
}

bool inline_condition_keyword_offset(const analyzed_ruby_T* analyzed, uint32_t* offset) {
  if (!analyzed || !analyzed->root || !offset) { return false; }

  inline_condition_offset_T context = {
    .offset = UINT32_MAX,
    .found = false,
  };

  pm_visit_node(analyzed->root, search_inline_condition_offset, &context);

  if (!context.found) { return false; }

  *offset = context.offset;

  return true;
}

bool has_error_message(analyzed_ruby_T* analyzed, const char* message) {
  for (const pm_diagnostic_t* error = pm_parser_errors_first(analyzed->parser); error != NULL;
       error = pm_diagnostic_next(error)) {
    if (string_equals(pm_diagnostic_message(error), message)) { return true; }
  }

  return false;
}

static bool location_matches(const uint8_t* source, pm_location_t location, const char* text, size_t length) {
  return location.length == length && memcmp(source + location.start, text, length) == 0;
}

bool is_do_block(const uint8_t* source, pm_location_t opening_location) {
  return location_matches(source, opening_location, "do", 2);
}

bool is_brace_block(const uint8_t* source, pm_location_t opening_location) {
  return location_matches(source, opening_location, "{", 1);
}

static bool is_end_keyword(const uint8_t* source, pm_location_t location) {
  return location_matches(source, location, "end", 3);
}

bool is_closing_brace(const uint8_t* source, pm_location_t location) {
  return location_matches(source, location, "}", 1);
}

bool has_valid_block_closing(const uint8_t* source, pm_location_t opening_loc, pm_location_t closing_loc) {
  if (is_do_block(source, opening_loc)) {
    return is_end_keyword(source, closing_loc);
  } else if (is_brace_block(source, opening_loc)) {
    return is_closing_brace(source, closing_loc);
  }

  return false;
}

static bool is_unclosed_block(const uint8_t* source, pm_location_t opening_loc, pm_location_t closing_loc) {
  bool has_opening = is_do_block(source, opening_loc) || is_brace_block(source, opening_loc);

  return has_opening && !has_valid_block_closing(source, opening_loc, closing_loc);
}

pm_visit_result_t search_control_flow_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;
  const uint8_t* source = pm_parser_start(analyzed->parser);

  switch (node->type) {
    case PM_IF_NODE: {
      const pm_if_node_t* if_node = (const pm_if_node_t*) node;

      if (herb_prism_location_assigned(if_node->if_keyword_loc)
          && herb_prism_location_assigned(if_node->end_keyword_loc)) {
        analyzed->if_node_count++;
      }

      if (herb_prism_location_assigned(if_node->then_keyword_loc)) { analyzed->then_keyword_count++; }
      break;
    }

    case PM_UNLESS_NODE: {
      const pm_unless_node_t* unless_node = (const pm_unless_node_t*) node;

      if (herb_prism_location_assigned(unless_node->unless_keyword_loc)
          && herb_prism_location_assigned(unless_node->end_keyword_loc)) {
        analyzed->unless_node_count++;
      }

      if (herb_prism_location_assigned(unless_node->then_keyword_loc)) { analyzed->then_keyword_count++; }
      break;
    }

    case PM_WHEN_NODE: {
      const pm_when_node_t* when_node = (const pm_when_node_t*) node;

      analyzed->when_node_count++;

      if (herb_prism_location_assigned(when_node->then_keyword_loc)) { analyzed->then_keyword_count++; }
      break;
    }

    case PM_BLOCK_NODE: {
      const pm_block_node_t* block_node = (const pm_block_node_t*) node;

      if (is_unclosed_block(source, block_node->opening_loc, block_node->closing_loc)) { analyzed->block_node_count++; }
      break;
    }

    case PM_LAMBDA_NODE: {
      const pm_lambda_node_t* lambda_node = (const pm_lambda_node_t*) node;

      if (is_unclosed_block(source, lambda_node->opening_loc, lambda_node->closing_loc)) {
        analyzed->block_node_count++;
      }
      break;
    }

    case PM_CASE_MATCH_NODE: {
      const pm_case_match_node_t* case_match_node = (const pm_case_match_node_t*) node;

      analyzed->case_match_node_count++;

      if (case_match_node->predicate != NULL && case_match_node->predicate->type == PM_MATCH_PREDICATE_NODE) {
        analyzed->in_node_count++;
      }
      break;
    }

    case PM_CASE_NODE: analyzed->case_node_count++; break;
    case PM_IN_NODE: analyzed->in_node_count++; break;
    case PM_WHILE_NODE: analyzed->while_node_count++; break;
    case PM_FOR_NODE: analyzed->for_node_count++; break;
    case PM_UNTIL_NODE: analyzed->until_node_count++; break;
    case PM_BEGIN_NODE: analyzed->begin_node_count++; break;
    case PM_YIELD_NODE: analyzed->yield_node_count++; break;

    default: break;
  }

  pm_visit_child_nodes(node, search_control_flow_nodes, analyzed);

  return PM_VISIT_SKIP;
}

void search_unexpected_keyword_errors(analyzed_ruby_T* analyzed) {
  bool unexpected_elsif = false;
  bool unexpected_else = false;
  bool unexpected_end = false;
  bool unexpected_equals = false;
  bool unexpected_closing_brace = false;
  bool unexpected_when = false;
  bool unexpected_in = false;
  bool unexpected_rescue = false;
  bool unexpected_ensure = false;

  for (const pm_diagnostic_t* error = pm_parser_errors_first(analyzed->parser); error != NULL;
       error = pm_diagnostic_next(error)) {
    const char* message = pm_diagnostic_message(error);

    if (string_equals(message, "unexpected 'elsif', ignoring it")) {
      unexpected_elsif = true;
    } else if (string_equals(message, "unexpected 'else', ignoring it")) {
      unexpected_else = true;
    } else if (string_equals(message, "unexpected 'end', ignoring it")) {
      unexpected_end = true;
    } else if (string_equals(message, "unexpected '=', ignoring it")) {
      unexpected_equals = true;
    } else if (string_equals(message, "unexpected '}', ignoring it")) {
      unexpected_closing_brace = true;
    } else if (string_equals(message, "unexpected 'when', ignoring it")) {
      unexpected_when = true;
    } else if (string_equals(message, "unexpected 'in', ignoring it")) {
      unexpected_in = true;
    } else if (string_equals(message, "unexpected 'rescue', ignoring it")) {
      unexpected_rescue = true;
    } else if (string_equals(message, "unexpected 'ensure', ignoring it")) {
      unexpected_ensure = true;
    }
  }

  if (unexpected_elsif) { analyzed->elsif_node_count++; }
  if (unexpected_else) { analyzed->else_node_count++; }
  if (unexpected_end && !unexpected_equals) { analyzed->end_count++; }
  if (unexpected_when) { analyzed->when_node_count++; }
  if (unexpected_in) { analyzed->in_node_count++; }
  if (unexpected_rescue) { analyzed->rescue_node_count++; }
  if (unexpected_ensure) { analyzed->ensure_node_count++; }
  if (unexpected_closing_brace) { analyzed->block_closing_count++; }
}

static bool is_postfix_conditional(const pm_statements_node_t* statements, pm_location_t keyword_location) {
  if (statements == NULL) { return false; }

  return statements->base.location.start < keyword_location.start;
}

pm_visit_result_t search_unclosed_control_flows(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;
  const uint8_t* source = pm_parser_start(analyzed->parser);

  if (analyzed->unclosed_control_flow_count >= 2) { return PM_VISIT_SKIP; }

  switch (node->type) {
    case PM_IF_NODE: {
      const pm_if_node_t* if_node = (const pm_if_node_t*) node;

      if (herb_prism_location_present(if_node->if_keyword_loc) && !is_end_keyword(source, if_node->end_keyword_loc)) {
        if (!is_postfix_conditional(if_node->statements, if_node->if_keyword_loc)) {
          analyzed->unclosed_control_flow_count++;
        }
      }

      break;
    }

    case PM_UNLESS_NODE: {
      const pm_unless_node_t* unless_node = (const pm_unless_node_t*) node;

      if (herb_prism_location_present(unless_node->unless_keyword_loc)
          && !is_end_keyword(source, unless_node->end_keyword_loc)) {
        if (!is_postfix_conditional(unless_node->statements, unless_node->unless_keyword_loc)) {
          analyzed->unclosed_control_flow_count++;
        }
      }

      break;
    }

    case PM_CASE_NODE: {
      const pm_case_node_t* case_node = (const pm_case_node_t*) node;

      if (herb_prism_location_present(case_node->case_keyword_loc)
          && !is_end_keyword(source, case_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_CASE_MATCH_NODE: {
      const pm_case_match_node_t* case_match_node = (const pm_case_match_node_t*) node;

      if (herb_prism_location_present(case_match_node->case_keyword_loc)
          && !is_end_keyword(source, case_match_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_WHILE_NODE: {
      const pm_while_node_t* while_node = (const pm_while_node_t*) node;

      if (herb_prism_location_present(while_node->while_keyword_loc)
          && !is_end_keyword(source, while_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_UNTIL_NODE: {
      const pm_until_node_t* until_node = (const pm_until_node_t*) node;

      if (herb_prism_location_present(until_node->until_keyword_loc)
          && !is_end_keyword(source, until_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_FOR_NODE: {
      const pm_for_node_t* for_node = (const pm_for_node_t*) node;

      if (herb_prism_location_present(for_node->for_keyword_loc)
          && !is_end_keyword(source, for_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_BEGIN_NODE: {
      const pm_begin_node_t* begin_node = (const pm_begin_node_t*) node;

      if (herb_prism_location_present(begin_node->begin_keyword_loc)
          && !is_end_keyword(source, begin_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_BLOCK_NODE: {
      const pm_block_node_t* block_node = (const pm_block_node_t*) node;
      bool has_opening =
        is_do_block(source, block_node->opening_loc) || is_brace_block(source, block_node->opening_loc);

      if (has_opening && !has_valid_block_closing(source, block_node->opening_loc, block_node->closing_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_LAMBDA_NODE: {
      const pm_lambda_node_t* lambda_node = (const pm_lambda_node_t*) node;
      bool has_opening =
        is_do_block(source, lambda_node->opening_loc) || is_brace_block(source, lambda_node->opening_loc);

      if (has_opening && !has_valid_block_closing(source, lambda_node->opening_loc, lambda_node->closing_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    default: break;
  }

  pm_visit_child_nodes(node, search_unclosed_control_flows, analyzed);

  return PM_VISIT_SKIP;
}

static pm_block_node_t* find_first_block_node(pm_node_t* node) {
  if (!node) { return NULL; }

  if (node->type == PM_CALL_NODE) {
    pm_call_node_t* call = (pm_call_node_t*) node;

    if (call->block && call->block->type == PM_BLOCK_NODE) { return (pm_block_node_t*) call->block; }
  }

  if (node->type == PM_PROGRAM_NODE) {
    pm_program_node_t* program = (pm_program_node_t*) node;

    if (program->statements && program->statements->body.size > 0) {
      return find_first_block_node(program->statements->body.nodes[0]);
    }
  }

  if (node->type == PM_STATEMENTS_NODE) {
    pm_statements_node_t* statements = (pm_statements_node_t*) node;

    if (statements->body.size > 0) { return find_first_block_node(statements->body.nodes[0]); }
  }

  return NULL;
}

static position_T prism_to_source_position(uint32_t prism_offset, size_t source_base_offset, const char* source) {
  if (!source) { return (position_T) { .line = 1, .column = 0 }; }

  return byte_offset_to_position(source, source_base_offset + prism_offset);
}

static token_T* create_parameter_name_token(
  pm_location_t location,
  const char* name,
  size_t source_base_offset,
  const char* source,
  hb_allocator_T* allocator
) {
  position_T start = prism_to_source_position(location.start, source_base_offset, source);
  position_T end = prism_to_source_position(herb_prism_location_end(location), source_base_offset, source);

  return create_synthetic_token(allocator, name, TOKEN_IDENTIFIER, start, end);
}

static void append_parameter(
  hb_array_T* result,
  token_T* name_token,
  AST_RUBY_LITERAL_NODE_T* default_value,
  const char* kind,
  bool required,
  position_T start,
  position_T end,
  hb_allocator_T* allocator
) {
  hb_array_append(
    result,
    ast_ruby_parameter_node_init(
      name_token,
      default_value,
      hb_string(kind),
      required,
      start,
      end,
      hb_array_init(0, allocator),
      allocator
    )
  );
}

static void append_required_positional(
  hb_array_T* result,
  pm_node_t* node,
  pm_parser_t* parser,
  const char* source,
  size_t source_base_offset,
  const uint8_t* prism_source_start,
  hb_allocator_T* allocator
);

static void append_multi_target_parameters(
  hb_array_T* result,
  pm_multi_target_node_t* multi_target,
  pm_parser_t* parser,
  const char* source,
  size_t source_base_offset,
  const uint8_t* prism_source_start,
  hb_allocator_T* allocator
) {
  for (size_t index = 0; index < multi_target->lefts.size; index++) {
    append_required_positional(
      result,
      multi_target->lefts.nodes[index],
      parser,
      source,
      source_base_offset,
      prism_source_start,
      allocator
    );
  }

  if (multi_target->rest && multi_target->rest->type == PM_SPLAT_NODE) {
    pm_splat_node_t* splat = (pm_splat_node_t*) multi_target->rest;

    if (splat->expression && splat->expression->type == PM_REQUIRED_PARAMETER_NODE) {
      pm_required_parameter_node_t* required = (pm_required_parameter_node_t*) splat->expression;
      const pm_constant_t* constant = pm_parser_constant(parser, required->name);

      if (constant) {
        char* name =
          hb_allocator_strndup(allocator, (const char*) pm_constant_start(constant), pm_constant_length(constant));
        pm_node_t* node = splat->expression;

        append_parameter(
          result,
          create_parameter_name_token(node->location, name, source_base_offset, source, allocator),
          NULL,
          "rest",
          false,
          prism_to_source_position(node->location.start, source_base_offset, source),
          prism_to_source_position(herb_prism_location_end(node->location), source_base_offset, source),
          allocator
        );

        hb_allocator_dealloc(allocator, name);
      }
    }
  }

  for (size_t index = 0; index < multi_target->rights.size; index++) {
    append_required_positional(
      result,
      multi_target->rights.nodes[index],
      parser,
      source,
      source_base_offset,
      prism_source_start,
      allocator
    );
  }
}

static void append_required_positional(
  hb_array_T* result,
  pm_node_t* node,
  pm_parser_t* parser,
  const char* source,
  size_t source_base_offset,
  const uint8_t* prism_source_start,
  hb_allocator_T* allocator
) {
  if (node->type == PM_MULTI_TARGET_NODE) {
    append_multi_target_parameters(
      result,
      (pm_multi_target_node_t*) node,
      parser,
      source,
      source_base_offset,
      prism_source_start,
      allocator
    );

    return;
  }

  if (node->type != PM_REQUIRED_PARAMETER_NODE) { return; }

  pm_required_parameter_node_t* required = (pm_required_parameter_node_t*) node;
  const pm_constant_t* constant = pm_parser_constant(parser, required->name);
  if (!constant) { return; }

  char* name = hb_allocator_strndup(allocator, (const char*) pm_constant_start(constant), pm_constant_length(constant));

  append_parameter(
    result,
    create_parameter_name_token(node->location, name, source_base_offset, source, allocator),
    NULL,
    "positional",
    true,
    prism_to_source_position(node->location.start, source_base_offset, source),
    prism_to_source_position(herb_prism_location_end(node->location), source_base_offset, source),
    allocator
  );

  hb_allocator_dealloc(allocator, name);
}

hb_array_T* extract_parameters_from_prism(
  pm_parameters_node_t* parameters,
  pm_parser_t* parser,
  const char* source,
  size_t source_base_offset,
  const uint8_t* prism_source_start,
  hb_allocator_T* allocator
) {
  if (!parameters) { return hb_array_init(0, allocator); }

  size_t count = parameters->requireds.size + parameters->optionals.size + parameters->keywords.size;
  if (parameters->rest) { count++; }
  if (parameters->keyword_rest) { count++; }
  if (parameters->block) { count++; }

  hb_array_T* result = hb_array_init(count, allocator);

  // Required positional: |item|, including destructured |(key, value)|
  for (size_t index = 0; index < parameters->requireds.size; index++) {
    append_required_positional(
      result,
      parameters->requireds.nodes[index],
      parser,
      source,
      source_base_offset,
      prism_source_start,
      allocator
    );
  }

  // Optional positional: |item = nil|
  for (size_t index = 0; index < parameters->optionals.size; index++) {
    pm_node_t* node = parameters->optionals.nodes[index];
    if (node->type != PM_OPTIONAL_PARAMETER_NODE) { continue; }

    pm_optional_parameter_node_t* optional = (pm_optional_parameter_node_t*) node;
    size_t name_length = optional->name_loc.length;
    char* name =
      hb_allocator_strndup(allocator, (const char*) (prism_source_start + optional->name_loc.start), name_length);

    position_T start = prism_to_source_position(node->location.start, source_base_offset, source);
    position_T end = prism_to_source_position(herb_prism_location_end(node->location), source_base_offset, source);

    AST_RUBY_LITERAL_NODE_T* default_value = NULL;

    if (optional->value) {
      size_t value_length = optional->value->location.length;
      char* value_string = hb_allocator_strndup(
        allocator,
        (const char*) (prism_source_start + optional->value->location.start),
        value_length
      );
      position_T value_start = prism_to_source_position(optional->value->location.start, source_base_offset, source);
      position_T value_end =
        prism_to_source_position(herb_prism_location_end(optional->value->location), source_base_offset, source);

      default_value = ast_ruby_literal_node_init(
        hb_string_from_c_string(value_string),
        value_start,
        value_end,
        hb_array_init(0, allocator),
        allocator
      );
      hb_allocator_dealloc(allocator, value_string);
    }

    append_parameter(
      result,
      create_parameter_name_token(optional->name_loc, name, source_base_offset, source, allocator),
      default_value,
      "positional",
      false,
      start,
      end,
      allocator
    );

    hb_allocator_dealloc(allocator, name);
  }

  // Rest: |*items|
  if (parameters->rest && parameters->rest->type == PM_REST_PARAMETER_NODE) {
    pm_rest_parameter_node_t* rest = (pm_rest_parameter_node_t*) parameters->rest;

    if (rest->name) {
      size_t name_length = rest->name_loc.length;
      char* name =
        hb_allocator_strndup(allocator, (const char*) (prism_source_start + rest->name_loc.start), name_length);

      position_T start = prism_to_source_position(parameters->rest->location.start, source_base_offset, source);
      position_T end =
        prism_to_source_position(herb_prism_location_end(parameters->rest->location), source_base_offset, source);

      append_parameter(
        result,
        create_parameter_name_token(rest->name_loc, name, source_base_offset, source, allocator),
        NULL,
        "rest",
        false,
        start,
        end,
        allocator
      );

      hb_allocator_dealloc(allocator, name);
    } else {
      append_parameter(
        result,
        NULL,
        NULL,
        "rest",
        false,
        prism_to_source_position(parameters->rest->location.start, source_base_offset, source),
        prism_to_source_position(herb_prism_location_end(parameters->rest->location), source_base_offset, source),
        allocator
      );
    }
  }

  // Post-rest positional: the |last| in |item, *rest, last|
  for (size_t index = 0; index < parameters->posts.size; index++) {
    append_required_positional(
      result,
      parameters->posts.nodes[index],
      parser,
      source,
      source_base_offset,
      prism_source_start,
      allocator
    );
  }

  // Keywords: |name:| or |title: "default"|
  for (size_t index = 0; index < parameters->keywords.size; index++) {
    pm_node_t* keyword = parameters->keywords.nodes[index];

    pm_location_t name_location;
    bool is_required = false;
    AST_RUBY_LITERAL_NODE_T* default_value = NULL;

    if (keyword->type == PM_REQUIRED_KEYWORD_PARAMETER_NODE) {
      name_location = ((pm_required_keyword_parameter_node_t*) keyword)->name_loc;
      is_required = true;
    } else if (keyword->type == PM_OPTIONAL_KEYWORD_PARAMETER_NODE) {
      pm_optional_keyword_parameter_node_t* optional_keyword = (pm_optional_keyword_parameter_node_t*) keyword;
      name_location = optional_keyword->name_loc;

      if (optional_keyword->value) {
        size_t value_length = optional_keyword->value->location.length;
        char* value_string = hb_allocator_strndup(
          allocator,
          (const char*) (prism_source_start + optional_keyword->value->location.start),
          value_length
        );

        position_T value_start =
          prism_to_source_position(optional_keyword->value->location.start, source_base_offset, source);

        position_T value_end = prism_to_source_position(
          herb_prism_location_end(optional_keyword->value->location),
          source_base_offset,
          source
        );

        default_value = ast_ruby_literal_node_init(
          hb_string_from_c_string(value_string),
          value_start,
          value_end,
          hb_array_init(0, allocator),
          allocator
        );

        hb_allocator_dealloc(allocator, value_string);
      }
    } else {
      continue;
    }

    size_t name_length = name_location.length;
    if (name_length > 0 && prism_source_start[name_location.start + name_length - 1] == ':') { name_length--; }
    char* name = hb_allocator_strndup(allocator, (const char*) (prism_source_start + name_location.start), name_length);

    position_T start = prism_to_source_position(keyword->location.start, source_base_offset, source);
    position_T end = prism_to_source_position(herb_prism_location_end(keyword->location), source_base_offset, source);

    append_parameter(
      result,
      create_parameter_name_token(name_location, name, source_base_offset, source, allocator),
      default_value,
      "keyword",
      is_required,
      start,
      end,
      allocator
    );

    hb_allocator_dealloc(allocator, name);
  }

  // Keyword rest: |**opts| or |**|
  if (parameters->keyword_rest && parameters->keyword_rest->type == PM_KEYWORD_REST_PARAMETER_NODE) {
    pm_keyword_rest_parameter_node_t* keyword_rest = (pm_keyword_rest_parameter_node_t*) parameters->keyword_rest;

    position_T start = prism_to_source_position(parameters->keyword_rest->location.start, source_base_offset, source);

    position_T end =
      prism_to_source_position(herb_prism_location_end(parameters->keyword_rest->location), source_base_offset, source);

    if (keyword_rest->name) {
      size_t name_length = keyword_rest->name_loc.length;
      char* name =
        hb_allocator_strndup(allocator, (const char*) (prism_source_start + keyword_rest->name_loc.start), name_length);

      append_parameter(
        result,
        create_parameter_name_token(keyword_rest->name_loc, name, source_base_offset, source, allocator),
        NULL,
        "keyword_rest",
        false,
        start,
        end,
        allocator
      );

      hb_allocator_dealloc(allocator, name);
    } else {
      // Anonymous **
      append_parameter(result, NULL, NULL, "keyword_rest", false, start, end, allocator);
    }
  }

  // Block: |&blk|
  if (parameters->block && parameters->block->type == PM_BLOCK_PARAMETER_NODE) {
    pm_block_parameter_node_t* block_param = (pm_block_parameter_node_t*) parameters->block;

    if (block_param->name) {
      size_t name_length = block_param->name_loc.length;
      char* name =
        hb_allocator_strndup(allocator, (const char*) (prism_source_start + block_param->name_loc.start), name_length);

      position_T start = prism_to_source_position(block_param->base.location.start, source_base_offset, source);
      position_T end =
        prism_to_source_position(herb_prism_location_end(block_param->base.location), source_base_offset, source);

      append_parameter(
        result,
        create_parameter_name_token(block_param->name_loc, name, source_base_offset, source, allocator),
        NULL,
        "block",
        false,
        start,
        end,
        allocator
      );

      hb_allocator_dealloc(allocator, name);
    } else {
      append_parameter(
        result,
        NULL,
        NULL,
        "block",
        false,
        prism_to_source_position(block_param->base.location.start, source_base_offset, source),
        prism_to_source_position(herb_prism_location_end(block_param->base.location), source_base_offset, source),
        allocator
      );
    }
  }

  return result;
}

hb_array_T* extract_block_arguments_from_erb_node(
  const AST_ERB_CONTENT_NODE_T* erb_node,
  const char* source,
  hb_array_T** errors,
  hb_allocator_T* allocator
) {
  if (!erb_node || !erb_node->analyzed_ruby || !erb_node->analyzed_ruby->parsed) { return hb_array_init(0, allocator); }

  pm_parser_t* parser = erb_node->analyzed_ruby->parser;
  pm_block_node_t* block_node = find_first_block_node(erb_node->analyzed_ruby->root);

  if (!block_node || !block_node->parameters) { return hb_array_init(0, allocator); }
  if (block_node->parameters->type != PM_BLOCK_PARAMETERS_NODE) { return hb_array_init(0, allocator); }

  pm_block_parameters_node_t* block_parameters = (pm_block_parameters_node_t*) block_node->parameters;
  size_t erb_content_offset = 0;

  if (source && erb_node->content) {
    erb_content_offset = calculate_byte_offset_from_position(source, erb_node->content->location.start);
  }

  const uint8_t* prism_source_start = pm_parser_start(parser);

  if (errors) {
    for (const pm_diagnostic_t* error = pm_parser_errors_first(parser); error != NULL;
         error = pm_diagnostic_next(error)) {
      if (error->diag_id == PM_ERR_BLOCK_TERM_END) { continue; }
      if (error->diag_id == PM_ERR_BLOCK_TERM_BRACE) { continue; }
      if (error->diag_id == PM_ERR_UNEXPECTED_TOKEN_CLOSE_CONTEXT) { continue; }

      size_t error_start_offset = error->location.start;
      size_t error_end_offset = herb_prism_location_end(error->location);

      position_T error_start = byte_offset_to_position(source, erb_content_offset + error_start_offset);
      position_T error_end = byte_offset_to_position(source, erb_content_offset + error_end_offset);

      RUBY_PARSE_ERROR_T* parse_error =
        ruby_parse_error_from_prism_error_with_positions(error, error_start, error_end, allocator);

      hb_array_append_lazy(errors, parse_error, allocator);
    }
  }

  return extract_parameters_from_prism(
    block_parameters->parameters,
    parser,
    source,
    erb_content_offset,
    prism_source_start,
    allocator
  );
}

bool is_erb_output_tag(const AST_ERB_CONTENT_NODE_T* erb_node) {
  if (!erb_node || !erb_node->tag_opening) { return false; }

  hb_string_T opening = erb_node->tag_opening->value;

  return opening.length >= 3 && opening.data[0] == '<' && opening.data[1] == '%' && opening.data[2] == '=';
}

static bool is_escape_neutral(hb_string_T content) {
  for (uint32_t index = 0; index < content.length; index++) {
    switch (content.data[index]) {
      case '&':
      case '<':
      case '>':
      case '"':
      case '\'': return false;

      default: break;
    }
  }

  return true;
}

static bool is_plain_decimal_integer(hb_string_T source) {
  uint32_t index = (source.length > 0 && source.data[0] == '-') ? 1 : 0;

  if (index >= source.length) { return false; }
  if (source.data[index] == '0' && (source.length - index) > 1) { return false; }

  for (uint32_t position = index; position < source.length; position++) {
    if (source.data[position] < '0' || source.data[position] > '9') { return false; }
  }

  return true;
}

static bool prism_node_static_output(const uint8_t* source, const pm_node_t* node, hb_string_T* output) {
  if (!node || !output) { return false; }

  switch (node->type) {
    case PM_STRING_NODE: {
      const pm_string_t* unescaped = &((const pm_string_node_t*) node)->unescaped;

      *output = hb_string_from_data((const char*) pm_string_source(unescaped), pm_string_length(unescaped));
      break;
    }

    case PM_SYMBOL_NODE: {
      const pm_string_t* unescaped = &((const pm_symbol_node_t*) node)->unescaped;

      *output = hb_string_from_data((const char*) pm_string_source(unescaped), pm_string_length(unescaped));
      break;
    }

    case PM_INTEGER_NODE: {
      hb_string_T integer = hb_string_from_data((const char*) (source + node->location.start), node->location.length);

      if (!is_plain_decimal_integer(integer)) { return false; }

      *output = integer;
      break;
    }

    case PM_TRUE_NODE: *output = hb_string("true"); break;
    case PM_FALSE_NODE: *output = hb_string("false"); break;
    case PM_NIL_NODE: *output = HB_STRING_EMPTY; break;

    default: return false;
  }

  return is_escape_neutral(*output);
}

static AST_NODE_T* create_static_output_node(
  hb_string_T content,
  static_output_node_type_T node_type,
  position_T start_position,
  position_T end_position,
  hb_allocator_T* allocator
) {
  switch (node_type) {
    case STATIC_OUTPUT_NODE_HTML_TEXT:
      return (
        AST_NODE_T*
      ) ast_html_text_node_init(content, start_position, end_position, hb_array_init(0, allocator), allocator);

    case STATIC_OUTPUT_NODE_LITERAL:
      return (
        AST_NODE_T*
      ) ast_literal_node_init(content, start_position, end_position, hb_array_init(0, allocator), allocator);

    default: return NULL;
  }
}

bool append_static_output_node(
  hb_array_T* statements,
  const pm_statements_node_t* body,
  const analyzed_ruby_T* analyzed,
  position_T content_start,
  static_output_node_type_T node_type,
  hb_allocator_T* allocator
) {
  if (!statements || !body || !analyzed) { return false; }
  if (node_type == STATIC_OUTPUT_NODE_NONE) { return false; }
  if (body->body.size != 1) { return false; }

  const pm_node_t* literal = body->body.nodes[0];
  const uint8_t* parser_start = pm_parser_start(analyzed->parser);
  size_t source_length = (size_t) (pm_parser_end(analyzed->parser) - parser_start);

  if (herb_prism_location_end(literal->location) > source_length) { return false; }

  hb_string_T content;

  if (!prism_node_static_output(parser_start, literal, &content)) { return false; }
  if (content.length == 0) { return true; }

  size_t offset = literal->location.start;
  size_t length = literal->location.length;

  position_T start_position = { .line = content_start.line, .column = content_start.column + (uint32_t) offset };
  position_T end_position = { .line = content_start.line,
                              .column = content_start.column + (uint32_t) (offset + length) };

  AST_NODE_T* node = create_static_output_node(content, node_type, start_position, end_position, allocator);

  if (!node) { return false; }

  hb_array_append(statements, node);

  return true;
}
