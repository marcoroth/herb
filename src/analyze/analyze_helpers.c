#include <prism.h>
#include <stdbool.h>
#include <string.h>

#include "../include/analyze/action_view/tag_helper_node_builders.h"
#include "../include/analyze/action_view/tag_helpers.h"
#include "../include/analyze/analyzed_ruby.h"
#include "../include/analyze/helpers.h"
#include "../include/ast/ast_nodes.h"
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

bool has_error_message(analyzed_ruby_T* analyzed, const char* message) {
  for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) analyzed->parser.error_list.head; error != NULL;
       error = (const pm_diagnostic_t*) error->node.next) {
    if (string_equals(error->message, message)) { return true; }
  }

  return false;
}

bool search_if_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_IF_NODE) {
    const pm_if_node_t* if_node = (const pm_if_node_t*) node;

    bool has_if_keyword = if_node->if_keyword_loc.start != NULL && if_node->if_keyword_loc.end != NULL;
    bool has_end_keyword = if_node->end_keyword_loc.start != NULL && if_node->end_keyword_loc.end != NULL;

    if (has_if_keyword && has_end_keyword) { analyzed->if_node_count++; }
  }

  pm_visit_child_nodes(node, search_if_nodes, analyzed);

  return false;
}

bool is_do_block(pm_location_t opening_location) {
  size_t length = opening_location.end - opening_location.start;

  return length == 2 && opening_location.start[0] == 'd' && opening_location.start[1] == 'o';
}

bool is_brace_block(pm_location_t opening_location) {
  size_t length = opening_location.end - opening_location.start;

  return length == 1 && opening_location.start[0] == '{';
}

static bool has_location(pm_location_t location) {
  return location.start != NULL && location.end != NULL && (location.end - location.start) > 0;
}

static bool is_end_keyword(pm_location_t location) {
  if (location.start == NULL || location.end == NULL) { return false; }

  size_t length = location.end - location.start;

  return length == 3 && location.start[0] == 'e' && location.start[1] == 'n' && location.start[2] == 'd';
}

bool is_closing_brace(pm_location_t location) {
  if (location.start == NULL || location.end == NULL) { return false; }

  size_t length = location.end - location.start;

  return length == 1 && location.start[0] == '}';
}

bool has_valid_block_closing(pm_location_t opening_loc, pm_location_t closing_loc) {
  if (is_do_block(opening_loc)) {
    return is_end_keyword(closing_loc);
  } else if (is_brace_block(opening_loc)) {
    return is_closing_brace(closing_loc);
  }

  return false;
}

bool search_block_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_BLOCK_NODE) {
    pm_block_node_t* block_node = (pm_block_node_t*) node;

    bool has_opening = is_do_block(block_node->opening_loc) || is_brace_block(block_node->opening_loc);
    bool is_unclosed = !has_valid_block_closing(block_node->opening_loc, block_node->closing_loc);

    if (has_opening && is_unclosed) { analyzed->block_node_count++; }
  }

  if (node->type == PM_LAMBDA_NODE) {
    pm_lambda_node_t* lambda_node = (pm_lambda_node_t*) node;

    bool has_opening = is_do_block(lambda_node->opening_loc) || is_brace_block(lambda_node->opening_loc);
    bool is_unclosed = !has_valid_block_closing(lambda_node->opening_loc, lambda_node->closing_loc);

    if (has_opening && is_unclosed) { analyzed->block_node_count++; }
  }

  pm_visit_child_nodes(node, search_block_nodes, analyzed);

  return false;
}

bool search_case_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_CASE_NODE) { analyzed->case_node_count++; }

  pm_visit_child_nodes(node, search_case_nodes, analyzed);

  return false;
}

bool search_case_match_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_CASE_MATCH_NODE) { analyzed->case_match_node_count++; }

  pm_visit_child_nodes(node, search_case_match_nodes, analyzed);

  return false;
}

bool search_while_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_WHILE_NODE) { analyzed->while_node_count++; }

  pm_visit_child_nodes(node, search_while_nodes, analyzed);

  return false;
}

bool search_for_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_FOR_NODE) { analyzed->for_node_count++; }

  pm_visit_child_nodes(node, search_for_nodes, analyzed);

  return false;
}

bool search_until_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_UNTIL_NODE) { analyzed->until_node_count++; }

  pm_visit_child_nodes(node, search_until_nodes, analyzed);

  return false;
}

bool search_begin_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_BEGIN_NODE) { analyzed->begin_node_count++; }

  pm_visit_child_nodes(node, search_begin_nodes, analyzed);

  return false;
}

bool search_unless_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_UNLESS_NODE) {
    const pm_unless_node_t* unless_node = (const pm_unless_node_t*) node;

    bool has_if_keyword = unless_node->keyword_loc.start != NULL && unless_node->keyword_loc.end != NULL;
    bool has_end_keyword = unless_node->end_keyword_loc.start != NULL && unless_node->end_keyword_loc.end != NULL;

    if (has_if_keyword && has_end_keyword) { analyzed->unless_node_count++; }
  }

  pm_visit_child_nodes(node, search_unless_nodes, analyzed);

  return false;
}

bool search_when_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_WHEN_NODE) { analyzed->when_node_count++; }

  pm_visit_child_nodes(node, search_when_nodes, analyzed);

  return false;
}

bool search_in_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_IN_NODE) { analyzed->in_node_count++; }
  if (node->type == PM_MATCH_PREDICATE_NODE) { analyzed->in_node_count++; }

  pm_visit_child_nodes(node, search_in_nodes, analyzed);

  return false;
}

bool search_unexpected_elsif_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'elsif', ignoring it")) {
    analyzed->elsif_node_count++;
    return true;
  }

  return false;
}

bool search_unexpected_else_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'else', ignoring it")) {
    analyzed->else_node_count++;
    return true;
  }

  return false;
}

bool search_unexpected_end_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'end', ignoring it")) {
    if (has_error_message(analyzed, "unexpected '=', ignoring it")) {
      // `=end`
      return false;
    }

    analyzed->end_count++;
    return true;
  }

  return false;
}

bool search_unexpected_block_closing_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected '}', ignoring it")) {
    analyzed->block_closing_count++;
    return true;
  }

  return false;
}

bool search_unexpected_when_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'when', ignoring it")) {
    analyzed->when_node_count++;
    return true;
  }

  return false;
}

bool search_unexpected_in_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'in', ignoring it")) {
    analyzed->in_node_count++;
    return true;
  }

  return false;
}

bool search_unexpected_rescue_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'rescue', ignoring it")) {
    analyzed->rescue_node_count++;
    return true;
  }

  return false;
}

bool search_unexpected_ensure_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'ensure', ignoring it")) {
    analyzed->ensure_node_count++;
    return true;
  }

  return false;
}

bool search_yield_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_YIELD_NODE) { analyzed->yield_node_count++; }

  pm_visit_child_nodes(node, search_yield_nodes, analyzed);

  return false;
}

bool search_then_keywords(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  switch (node->type) {
    case PM_IF_NODE: {
      const pm_if_node_t* if_node = (const pm_if_node_t*) node;
      if (if_node->then_keyword_loc.start != NULL && if_node->then_keyword_loc.end != NULL) {
        analyzed->then_keyword_count++;
      }
      break;
    }

    case PM_UNLESS_NODE: {
      const pm_unless_node_t* unless_node = (const pm_unless_node_t*) node;
      if (unless_node->then_keyword_loc.start != NULL && unless_node->then_keyword_loc.end != NULL) {
        analyzed->then_keyword_count++;
      }
      break;
    }

    case PM_WHEN_NODE: {
      const pm_when_node_t* when_node = (const pm_when_node_t*) node;
      if (when_node->then_keyword_loc.start != NULL && when_node->then_keyword_loc.end != NULL) {
        analyzed->then_keyword_count++;
      }
      break;
    }

    default: break;
  }

  pm_visit_child_nodes(node, search_then_keywords, analyzed);

  return false;
}

static bool is_postfix_conditional(const pm_statements_node_t* statements, pm_location_t keyword_location) {
  if (statements == NULL) { return false; }

  return statements->base.location.start < keyword_location.start;
}

bool search_unclosed_control_flows(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (analyzed->unclosed_control_flow_count >= 2) { return false; }

  switch (node->type) {
    case PM_IF_NODE: {
      const pm_if_node_t* if_node = (const pm_if_node_t*) node;

      if (has_location(if_node->if_keyword_loc) && !is_end_keyword(if_node->end_keyword_loc)) {
        if (!is_postfix_conditional(if_node->statements, if_node->if_keyword_loc)) {
          analyzed->unclosed_control_flow_count++;
        }
      }

      break;
    }

    case PM_UNLESS_NODE: {
      const pm_unless_node_t* unless_node = (const pm_unless_node_t*) node;

      if (has_location(unless_node->keyword_loc) && !is_end_keyword(unless_node->end_keyword_loc)) {
        if (!is_postfix_conditional(unless_node->statements, unless_node->keyword_loc)) {
          analyzed->unclosed_control_flow_count++;
        }
      }

      break;
    }

    case PM_CASE_NODE: {
      const pm_case_node_t* case_node = (const pm_case_node_t*) node;

      if (has_location(case_node->case_keyword_loc) && !is_end_keyword(case_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_CASE_MATCH_NODE: {
      const pm_case_match_node_t* case_match_node = (const pm_case_match_node_t*) node;

      if (has_location(case_match_node->case_keyword_loc) && !is_end_keyword(case_match_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_WHILE_NODE: {
      const pm_while_node_t* while_node = (const pm_while_node_t*) node;

      if (has_location(while_node->keyword_loc) && !is_end_keyword(while_node->closing_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_UNTIL_NODE: {
      const pm_until_node_t* until_node = (const pm_until_node_t*) node;

      if (has_location(until_node->keyword_loc) && !is_end_keyword(until_node->closing_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_FOR_NODE: {
      const pm_for_node_t* for_node = (const pm_for_node_t*) node;

      if (has_location(for_node->for_keyword_loc) && !is_end_keyword(for_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_BEGIN_NODE: {
      const pm_begin_node_t* begin_node = (const pm_begin_node_t*) node;

      if (has_location(begin_node->begin_keyword_loc) && !is_end_keyword(begin_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_BLOCK_NODE: {
      const pm_block_node_t* block_node = (const pm_block_node_t*) node;
      bool has_opening = is_do_block(block_node->opening_loc) || is_brace_block(block_node->opening_loc);

      if (has_opening && !has_valid_block_closing(block_node->opening_loc, block_node->closing_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_LAMBDA_NODE: {
      const pm_lambda_node_t* lambda_node = (const pm_lambda_node_t*) node;
      bool has_opening = is_do_block(lambda_node->opening_loc) || is_brace_block(lambda_node->opening_loc);

      if (has_opening && !has_valid_block_closing(lambda_node->opening_loc, lambda_node->closing_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    default: break;
  }

  pm_visit_child_nodes(node, search_unclosed_control_flows, analyzed);

  return false;
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

static position_T prism_to_source_position(
  const uint8_t* prism_pointer,
  const uint8_t* prism_source_start,
  size_t source_base_offset,
  const char* source
) {
  if (!source || !prism_source_start) { return (position_T) { .line = 1, .column = 0 }; }

  size_t prism_offset = (size_t) (prism_pointer - prism_source_start);
  return byte_offset_to_position(source, source_base_offset + prism_offset);
}

static token_T* create_parameter_name_token(
  pm_location_t location,
  const char* name,
  const uint8_t* prism_source_start,
  size_t source_base_offset,
  const char* source,
  hb_allocator_T* allocator
) {
  position_T start = prism_to_source_position(location.start, prism_source_start, source_base_offset, source);
  position_T end = prism_to_source_position(location.end, prism_source_start, source_base_offset, source);

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

  // Required positional: |item|
  for (size_t index = 0; index < parameters->requireds.size; index++) {
    pm_node_t* node = parameters->requireds.nodes[index];
    if (node->type != PM_REQUIRED_PARAMETER_NODE) { continue; }

    pm_required_parameter_node_t* required = (pm_required_parameter_node_t*) node;
    pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, required->name);
    if (!constant) { continue; }

    char* name = hb_allocator_strndup(allocator, (const char*) constant->start, constant->length);
    position_T start = prism_to_source_position(node->location.start, prism_source_start, source_base_offset, source);
    position_T end = prism_to_source_position(node->location.end, prism_source_start, source_base_offset, source);

    append_parameter(
      result,
      create_parameter_name_token(node->location, name, prism_source_start, source_base_offset, source, allocator),
      NULL,
      "positional",
      true,
      start,
      end,
      allocator
    );

    hb_allocator_dealloc(allocator, name);
  }

  // Optional positional: |item = nil|
  for (size_t index = 0; index < parameters->optionals.size; index++) {
    pm_node_t* node = parameters->optionals.nodes[index];
    if (node->type != PM_OPTIONAL_PARAMETER_NODE) { continue; }

    pm_optional_parameter_node_t* optional = (pm_optional_parameter_node_t*) node;
    size_t name_length = (size_t) (optional->name_loc.end - optional->name_loc.start);
    char* name = hb_allocator_strndup(allocator, (const char*) optional->name_loc.start, name_length);

    position_T start = prism_to_source_position(node->location.start, prism_source_start, source_base_offset, source);
    position_T end = prism_to_source_position(node->location.end, prism_source_start, source_base_offset, source);

    AST_RUBY_LITERAL_NODE_T* default_value = NULL;

    if (optional->value) {
      size_t value_length = (size_t) (optional->value->location.end - optional->value->location.start);
      char* value_string = hb_allocator_strndup(allocator, (const char*) optional->value->location.start, value_length);
      position_T value_start =
        prism_to_source_position(optional->value->location.start, prism_source_start, source_base_offset, source);
      position_T value_end =
        prism_to_source_position(optional->value->location.end, prism_source_start, source_base_offset, source);

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
      create_parameter_name_token(optional->name_loc, name, prism_source_start, source_base_offset, source, allocator),
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
      size_t name_length = (size_t) (rest->name_loc.end - rest->name_loc.start);
      char* name = hb_allocator_strndup(allocator, (const char*) rest->name_loc.start, name_length);

      position_T start =
        prism_to_source_position(parameters->rest->location.start, prism_source_start, source_base_offset, source);
      position_T end =
        prism_to_source_position(parameters->rest->location.end, prism_source_start, source_base_offset, source);

      append_parameter(
        result,
        create_parameter_name_token(rest->name_loc, name, prism_source_start, source_base_offset, source, allocator),
        NULL,
        "rest",
        false,
        start,
        end,
        allocator
      );

      hb_allocator_dealloc(allocator, name);
    }
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
        size_t value_length =
          (size_t) (optional_keyword->value->location.end - optional_keyword->value->location.start);
        char* value_string =
          hb_allocator_strndup(allocator, (const char*) optional_keyword->value->location.start, value_length);

        position_T value_start = prism_to_source_position(
          optional_keyword->value->location.start,
          prism_source_start,
          source_base_offset,
          source
        );

        position_T value_end = prism_to_source_position(
          optional_keyword->value->location.end,
          prism_source_start,
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

    size_t name_length = (size_t) (name_location.end - name_location.start);
    if (name_length > 0 && name_location.start[name_length - 1] == ':') { name_length--; }
    char* name = hb_allocator_strndup(allocator, (const char*) name_location.start, name_length);

    position_T start =
      prism_to_source_position(keyword->location.start, prism_source_start, source_base_offset, source);
    position_T end = prism_to_source_position(keyword->location.end, prism_source_start, source_base_offset, source);

    append_parameter(
      result,
      create_parameter_name_token(name_location, name, prism_source_start, source_base_offset, source, allocator),
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

    position_T start = prism_to_source_position(
      parameters->keyword_rest->location.start,
      prism_source_start,
      source_base_offset,
      source
    );

    position_T end =
      prism_to_source_position(parameters->keyword_rest->location.end, prism_source_start, source_base_offset, source);

    if (keyword_rest->name) {
      size_t name_length = (size_t) (keyword_rest->name_loc.end - keyword_rest->name_loc.start);
      char* name = hb_allocator_strndup(allocator, (const char*) keyword_rest->name_loc.start, name_length);

      append_parameter(
        result,
        create_parameter_name_token(
          keyword_rest->name_loc,
          name,
          prism_source_start,
          source_base_offset,
          source,
          allocator
        ),
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
  if (parameters->block) {
    pm_block_parameter_node_t* block_param = parameters->block;

    if (block_param->name) {
      size_t name_length = (size_t) (block_param->name_loc.end - block_param->name_loc.start);
      char* name = hb_allocator_strndup(allocator, (const char*) block_param->name_loc.start, name_length);

      position_T start =
        prism_to_source_position(block_param->base.location.start, prism_source_start, source_base_offset, source);
      position_T end =
        prism_to_source_position(block_param->base.location.end, prism_source_start, source_base_offset, source);

      append_parameter(
        result,
        create_parameter_name_token(
          block_param->name_loc,
          name,
          prism_source_start,
          source_base_offset,
          source,
          allocator
        ),
        NULL,
        "block",
        false,
        start,
        end,
        allocator
      );

      hb_allocator_dealloc(allocator, name);
    }
  }

  return result;
}

hb_array_T* extract_block_arguments_from_erb_node(
  const AST_ERB_CONTENT_NODE_T* erb_node,
  const char* source,
  hb_array_T* errors,
  hb_allocator_T* allocator
) {
  if (!erb_node || !erb_node->analyzed_ruby || !erb_node->analyzed_ruby->parsed) { return hb_array_init(0, allocator); }

  pm_parser_t* parser = &erb_node->analyzed_ruby->parser;
  pm_block_node_t* block_node = find_first_block_node(erb_node->analyzed_ruby->root);

  if (!block_node || !block_node->parameters) { return hb_array_init(0, allocator); }
  if (block_node->parameters->type != PM_BLOCK_PARAMETERS_NODE) { return hb_array_init(0, allocator); }

  pm_block_parameters_node_t* block_parameters = (pm_block_parameters_node_t*) block_node->parameters;
  size_t erb_content_offset = 0;

  if (source && erb_node->content) {
    erb_content_offset = calculate_byte_offset_from_position(source, erb_node->content->location.start);
  }

  const uint8_t* prism_source_start = (const uint8_t*) parser->start;

  if (errors) {
    for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) parser->error_list.head; error != NULL;
         error = (const pm_diagnostic_t*) error->node.next) {
      if (error->diag_id == PM_ERR_BLOCK_TERM_END) { continue; }
      if (error->diag_id == PM_ERR_BLOCK_TERM_BRACE) { continue; }
      if (error->diag_id == PM_ERR_UNEXPECTED_TOKEN_CLOSE_CONTEXT) { continue; }

      size_t error_start_offset = (size_t) (error->location.start - prism_source_start);
      size_t error_end_offset = (size_t) (error->location.end - prism_source_start);

      position_T error_start = byte_offset_to_position(source, erb_content_offset + error_start_offset);
      position_T error_end = byte_offset_to_position(source, erb_content_offset + error_end_offset);

      RUBY_PARSE_ERROR_T* parse_error =
        ruby_parse_error_from_prism_error_with_positions(error, error_start, error_end, allocator);

      hb_array_append(errors, parse_error);
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
