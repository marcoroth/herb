#include "../include/analyze/strict_locals.h"
#include "../include/analyze/action_view/tag_helper_node_builders.h"
#include "../include/analyze/action_view/tag_helpers.h"
#include "../include/analyze/analyze.h"
#include "../include/ast/ast_nodes.h"
#include "../include/errors.h"
#include "../include/lib/hb_allocator.h"
#include "../include/lib/hb_array.h"
#include "../include/lib/hb_buffer.h"
#include "../include/lib/hb_string.h"
#include "../include/util/util.h"
#include "../include/visitor.h"

#include "../include/prism/prism_helpers.h"

#include <prism.h>
#include <stdbool.h>
#include <string.h>

#define STRICT_LOCALS_PREFIX "locals:"
#define SYNTHETIC_PREFIX "def _"
#define SYNTHETIC_SUFFIX "; end"

static bool is_strict_locals_node(const AST_ERB_CONTENT_NODE_T* node) {
  if (!node->tag_opening || !node->content) { return false; }
  if (hb_string_is_empty(node->tag_opening->value)) { return false; }

  const char* opening = node->tag_opening->value.data;
  if (!opening || !strstr(opening, "#")) { return false; }

  const char* content = node->content->value.data;
  if (!content) { return false; }

  while (is_whitespace(*content)) {
    content++;
  }

  return strncmp(content, STRICT_LOCALS_PREFIX, strlen(STRICT_LOCALS_PREFIX)) == 0;
}

static const char* find_params_open(const char* content) {
  while (is_whitespace(*content)) {
    content++;
  }

  if (strncmp(content, STRICT_LOCALS_PREFIX, strlen(STRICT_LOCALS_PREFIX)) != 0) { return NULL; }
  content += strlen(STRICT_LOCALS_PREFIX);

  while (is_whitespace(*content)) {
    content++;
  }

  if (*content != '(') { return NULL; }
  return content;
}

static const char* find_params_close(const char* opening_paren) {
  int depth = 0;
  const char* cursor = opening_paren;

  while (*cursor) {
    if (*cursor == '(') {
      depth++;
    } else if (*cursor == ')') {
      depth--;
      if (depth == 0) { return cursor; }
    }

    cursor++;
  }

  return NULL;
}

static bool build_synthetic_ruby(
  const char* params_open,
  size_t params_length,
  hb_buffer_T* buffer,
  hb_allocator_T* allocator
) {
  size_t capacity = strlen(SYNTHETIC_PREFIX) + params_length + strlen(SYNTHETIC_SUFFIX) + 1;
  if (!hb_buffer_init(buffer, capacity, allocator)) { return false; }

  hb_buffer_append(buffer, SYNTHETIC_PREFIX);
  hb_buffer_append_with_length(buffer, params_open, params_length);
  hb_buffer_append(buffer, SYNTHETIC_SUFFIX);

  return true;
}

static pm_parameters_node_t* find_parameters_node(pm_node_t* root) {
  if (!root || root->type != PM_PROGRAM_NODE) { return NULL; }

  pm_program_node_t* program = (pm_program_node_t*) root;
  if (!program->statements || program->statements->body.size == 0) { return NULL; }

  pm_node_t* first = program->statements->body.nodes[0];
  if (!first || first->type != PM_DEF_NODE) { return NULL; }

  pm_def_node_t* def_node = (pm_def_node_t*) first;
  return def_node->parameters;
}

static token_T* create_strict_local_token(
  const uint8_t* prism_node_start,
  const uint8_t* prism_node_end,
  const char* name,
  token_type_T type,
  const char* source,
  size_t erb_content_byte_offset,
  const char* content_bytes,
  const char* params_open,
  const uint8_t* synthetic_start,
  hb_allocator_T* allocator
) {
  size_t params_in_content = (size_t) (params_open - content_bytes);
  size_t prism_start_in_synthetic = (size_t) (prism_node_start - synthetic_start);
  size_t prism_end_in_synthetic = (size_t) (prism_node_end - synthetic_start);
  size_t content_start = params_in_content + (prism_start_in_synthetic - strlen(SYNTHETIC_PREFIX));
  size_t content_end = params_in_content + (prism_end_in_synthetic - strlen(SYNTHETIC_PREFIX));

  position_T start = byte_offset_to_position(source, erb_content_byte_offset + content_start);
  position_T end = byte_offset_to_position(source, erb_content_byte_offset + content_end);

  return create_synthetic_token(allocator, name, type, start, end);
}

static char* extract_name_from_location(pm_location_t name_location, hb_allocator_T* allocator) {
  size_t length = (size_t) (name_location.end - name_location.start);

  if (length > 0 && name_location.start[length - 1] == ':') { length--; }

  return hb_allocator_strndup(allocator, (const char*) name_location.start, length);
}

static hb_array_T* extract_strict_locals(
  pm_parameters_node_t* params,
  const char* source,
  size_t erb_content_byte_offset,
  const char* content_bytes,
  const char* params_open,
  const uint8_t* synthetic_start,
  hb_array_T* errors,
  hb_allocator_T* allocator
) {
  hb_array_T* locals = hb_array_init(4, allocator);

  if (!params) { return locals; }

  for (size_t index = 0; index < params->optionals.size; index++) {
    pm_node_t* optional = params->optionals.nodes[index];
    if (!optional || optional->type != PM_OPTIONAL_PARAMETER_NODE) { continue; }

    pm_optional_parameter_node_t* optional_param = (pm_optional_parameter_node_t*) optional;
    pm_location_t location = optional_param->name_loc;
    size_t length = (size_t) (location.end - location.start);
    char* name = hb_allocator_strndup(allocator, (const char*) location.start, length);

    token_T* name_token = create_strict_local_token(
      location.start,
      location.end,
      name,
      TOKEN_IDENTIFIER,
      source,
      erb_content_byte_offset,
      content_bytes,
      params_open,
      synthetic_start,
      allocator
    );

    position_T start = name_token ? name_token->location.start : (position_T) { .line = 1, .column = 1 };
    position_T end = name_token ? name_token->location.end : start;

    size_t value_prism_start = (size_t) (optional_param->value->location.start - synthetic_start);
    size_t value_prism_end = (size_t) (optional_param->value->location.end - synthetic_start);
    size_t params_in_content = (size_t) (params_open - content_bytes);
    size_t value_content_start = params_in_content + (value_prism_start - strlen(SYNTHETIC_PREFIX));
    size_t value_content_end = params_in_content + (value_prism_end - strlen(SYNTHETIC_PREFIX));

    size_t value_length = value_prism_end - value_prism_start;
    char* value_string =
      hb_allocator_strndup(allocator, (const char*) optional_param->value->location.start, value_length);

    position_T value_start = byte_offset_to_position(source, erb_content_byte_offset + value_content_start);
    position_T value_end = byte_offset_to_position(source, erb_content_byte_offset + value_content_end);

    AST_RUBY_LITERAL_NODE_T* value_node = ast_ruby_literal_node_init(
      hb_string_from_c_string(value_string),
      value_start,
      value_end,
      hb_array_init(0, allocator),
      allocator
    );

    hb_array_T* node_errors = hb_array_init(1, allocator);
    append_strict_locals_positional_argument_error(hb_string_from_c_string(name), start, end, allocator, node_errors);

    AST_RUBY_STRICT_LOCAL_NODE_T* local =
      ast_ruby_strict_local_node_init(name_token, value_node, false, false, start, value_end, node_errors, allocator);

    hb_array_append(locals, local);
    hb_allocator_dealloc(allocator, name);
    hb_allocator_dealloc(allocator, value_string);
  }

  for (size_t index = 0; index < params->requireds.size; index++) {
    pm_node_t* required = params->requireds.nodes[index];
    if (!required) { continue; }

    pm_location_t location = required->location;
    size_t length = (size_t) (location.end - location.start);
    char* name = hb_allocator_strndup(allocator, (const char*) location.start, length);

    token_T* name_token = create_strict_local_token(
      location.start,
      location.end,
      name,
      TOKEN_IDENTIFIER,
      source,
      erb_content_byte_offset,
      content_bytes,
      params_open,
      synthetic_start,
      allocator
    );

    position_T start = name_token ? name_token->location.start : (position_T) { .line = 1, .column = 1 };
    position_T end = name_token ? name_token->location.end : start;

    hb_array_T* node_errors = hb_array_init(1, allocator);
    append_strict_locals_positional_argument_error(hb_string_from_c_string(name), start, end, allocator, node_errors);

    AST_RUBY_STRICT_LOCAL_NODE_T* local =
      ast_ruby_strict_local_node_init(name_token, NULL, true, false, start, end, node_errors, allocator);

    hb_array_append(locals, local);
    hb_allocator_dealloc(allocator, name);
  }

  if (params->block) {
    pm_block_parameter_node_t* block_param = params->block;

    if (block_param->name) {
      size_t length = (size_t) (block_param->name_loc.end - block_param->name_loc.start);
      char* name = hb_allocator_strndup(allocator, (const char*) block_param->name_loc.start, length);

      token_T* name_token = create_strict_local_token(
        block_param->name_loc.start,
        block_param->name_loc.end,
        name,
        TOKEN_IDENTIFIER,
        source,
        erb_content_byte_offset,
        content_bytes,
        params_open,
        synthetic_start,
        allocator
      );

      position_T start = name_token ? name_token->location.start : (position_T) { .line = 1, .column = 1 };
      position_T end = name_token ? name_token->location.end : start;

      hb_array_T* node_errors = hb_array_init(1, allocator);
      append_strict_locals_block_argument_error(hb_string_from_c_string(name), start, end, allocator, node_errors);

      AST_RUBY_STRICT_LOCAL_NODE_T* local =
        ast_ruby_strict_local_node_init(name_token, NULL, false, false, start, end, node_errors, allocator);

      hb_array_append(locals, local);
      hb_allocator_dealloc(allocator, name);
    }
  }

  if (params->rest && params->rest->type == PM_REST_PARAMETER_NODE) {
    pm_rest_parameter_node_t* splat_param = (pm_rest_parameter_node_t*) params->rest;

    if (splat_param->name) {
      size_t length = (size_t) (splat_param->name_loc.end - splat_param->name_loc.start);
      char* name = hb_allocator_strndup(allocator, (const char*) splat_param->name_loc.start, length);

      token_T* name_token = create_strict_local_token(
        splat_param->name_loc.start,
        splat_param->name_loc.end,
        name,
        TOKEN_IDENTIFIER,
        source,
        erb_content_byte_offset,
        content_bytes,
        params_open,
        synthetic_start,
        allocator
      );

      position_T start = name_token ? name_token->location.start : (position_T) { .line = 1, .column = 1 };
      position_T end = name_token ? name_token->location.end : start;

      hb_array_T* node_errors = hb_array_init(1, allocator);
      append_strict_locals_splat_argument_error(hb_string_from_c_string(name), start, end, allocator, node_errors);

      AST_RUBY_STRICT_LOCAL_NODE_T* local =
        ast_ruby_strict_local_node_init(name_token, NULL, false, false, start, end, node_errors, allocator);

      hb_array_append(locals, local);
      hb_allocator_dealloc(allocator, name);
    }
  }

  for (size_t index = 0; index < params->keywords.size; index++) {
    pm_node_t* keyword_node = params->keywords.nodes[index];

    if (keyword_node->type == PM_REQUIRED_KEYWORD_PARAMETER_NODE) {
      pm_required_keyword_parameter_node_t* keyword_param = (pm_required_keyword_parameter_node_t*) keyword_node;

      char* name = extract_name_from_location(keyword_param->name_loc, allocator);
      if (!name) { continue; }

      token_T* name_token = create_strict_local_token(
        keyword_param->name_loc.start,
        keyword_param->name_loc.end,
        name,
        TOKEN_IDENTIFIER,
        source,
        erb_content_byte_offset,
        content_bytes,
        params_open,
        synthetic_start,
        allocator
      );

      position_T start = name_token ? name_token->location.start : (position_T) { .line = 1, .column = 1 };
      position_T end = name_token ? name_token->location.end : start;

      AST_RUBY_STRICT_LOCAL_NODE_T* local = ast_ruby_strict_local_node_init(
        name_token,
        NULL,
        true,
        false,
        start,
        end,
        hb_array_init(0, allocator),
        allocator
      );

      hb_array_append(locals, local);
      hb_allocator_dealloc(allocator, name);

    } else if (keyword_node->type == PM_OPTIONAL_KEYWORD_PARAMETER_NODE) {
      pm_optional_keyword_parameter_node_t* keyword_param = (pm_optional_keyword_parameter_node_t*) keyword_node;

      char* name = extract_name_from_location(keyword_param->name_loc, allocator);
      if (!name) { continue; }

      size_t value_prism_start = (size_t) (keyword_param->value->location.start - synthetic_start);
      size_t value_prism_end = (size_t) (keyword_param->value->location.end - synthetic_start);
      size_t params_in_content = (size_t) (params_open - content_bytes);
      size_t value_content_start = params_in_content + (value_prism_start - strlen(SYNTHETIC_PREFIX));
      size_t value_content_end = params_in_content + (value_prism_end - strlen(SYNTHETIC_PREFIX));

      size_t value_length = value_prism_end - value_prism_start;
      char* value_string =
        hb_allocator_strndup(allocator, (const char*) keyword_param->value->location.start, value_length);

      position_T value_start = byte_offset_to_position(source, erb_content_byte_offset + value_content_start);
      position_T value_end = byte_offset_to_position(source, erb_content_byte_offset + value_content_end);

      AST_RUBY_LITERAL_NODE_T* value_node = ast_ruby_literal_node_init(
        hb_string_from_c_string(value_string),
        value_start,
        value_end,
        hb_array_init(0, allocator),
        allocator
      );

      token_T* name_token = create_strict_local_token(
        keyword_param->name_loc.start,
        keyword_param->name_loc.end,
        name,
        TOKEN_IDENTIFIER,
        source,
        erb_content_byte_offset,
        content_bytes,
        params_open,
        synthetic_start,
        allocator
      );

      position_T start = name_token ? name_token->location.start : (position_T) { .line = 1, .column = 1 };

      AST_RUBY_STRICT_LOCAL_NODE_T* local = ast_ruby_strict_local_node_init(
        name_token,
        value_node,
        false,
        false,
        start,
        value_end,
        hb_array_init(0, allocator),
        allocator
      );

      hb_array_append(locals, local);
      hb_allocator_dealloc(allocator, name);
      hb_allocator_dealloc(allocator, value_string);
    }
  }

  if (params->keyword_rest && params->keyword_rest->type == PM_KEYWORD_REST_PARAMETER_NODE) {
    pm_keyword_rest_parameter_node_t* keyword_rest_param = (pm_keyword_rest_parameter_node_t*) params->keyword_rest;

    if (keyword_rest_param->name) {
      char* name = extract_name_from_location(keyword_rest_param->name_loc, allocator);
      if (!name) { return locals; }

      token_T* name_token = create_strict_local_token(
        keyword_rest_param->name_loc.start,
        keyword_rest_param->name_loc.end,
        name,
        TOKEN_IDENTIFIER,
        source,
        erb_content_byte_offset,
        content_bytes,
        params_open,
        synthetic_start,
        allocator
      );

      position_T start = name_token ? name_token->location.start : (position_T) { .line = 1, .column = 1 };
      position_T end = name_token ? name_token->location.end : start;

      AST_RUBY_STRICT_LOCAL_NODE_T* local = ast_ruby_strict_local_node_init(
        name_token,
        NULL,
        false,
        true,
        start,
        end,
        hb_array_init(0, allocator),
        allocator
      );

      hb_array_append(locals, local);
      hb_allocator_dealloc(allocator, name);
    } else {
      size_t params_in_content = (size_t) (params_open - content_bytes);
      size_t operator_prism_start = (size_t) (keyword_rest_param->operator_loc.start - synthetic_start);
      size_t operator_prism_end = (size_t) (keyword_rest_param->operator_loc.end - synthetic_start);
      size_t content_start = params_in_content + (operator_prism_start - strlen(SYNTHETIC_PREFIX));
      size_t content_end = params_in_content + (operator_prism_end - strlen(SYNTHETIC_PREFIX));

      position_T start = byte_offset_to_position(source, erb_content_byte_offset + content_start);
      position_T end = byte_offset_to_position(source, erb_content_byte_offset + content_end);

      AST_RUBY_STRICT_LOCAL_NODE_T* local =
        ast_ruby_strict_local_node_init(NULL, NULL, false, true, start, end, hb_array_init(0, allocator), allocator);

      hb_array_append(locals, local);
    }
  }

  return locals;
}

static AST_ERB_STRICT_LOCALS_NODE_T* create_strict_locals_node(
  AST_ERB_CONTENT_NODE_T* erb_node,
  const char* source,
  hb_allocator_T* allocator
) {
  const char* content_bytes = erb_node->content->value.data;
  const char* params_open = find_params_open(content_bytes);

  if (!params_open) {
    hb_array_T* locals = hb_array_init(0, allocator);
    hb_array_T* errors = hb_array_init(0, allocator);

    const char* after_prefix = content_bytes;
    while (is_whitespace(*after_prefix)) {
      after_prefix++;
    }
    after_prefix += strlen(STRICT_LOCALS_PREFIX);
    while (is_whitespace(*after_prefix)) {
      after_prefix++;
    }

    size_t content_length = (size_t) erb_node->content->value.length;
    size_t after_prefix_offset = (size_t) (after_prefix - content_bytes);
    size_t rest_length = after_prefix_offset < content_length ? content_length - after_prefix_offset : 0;

    while (rest_length > 0 && is_whitespace(after_prefix[rest_length - 1])) {
      rest_length--;
    }

    char* rest = hb_allocator_strndup(allocator, after_prefix, rest_length);
    size_t erb_content_byte_offset = calculate_byte_offset_from_position(source, erb_node->content->location.start);

    position_T error_start = byte_offset_to_position(source, erb_content_byte_offset + after_prefix_offset);
    position_T error_end = byte_offset_to_position(source, erb_content_byte_offset + after_prefix_offset + rest_length);

    append_strict_locals_missing_parenthesis_error(
      hb_string_from_c_string(rest),
      error_start,
      error_end,
      allocator,
      errors
    );
    hb_allocator_dealloc(allocator, rest);

    return ast_erb_strict_locals_node_init(
      erb_node->tag_opening,
      erb_node->content,
      erb_node->tag_closing,
      erb_node->analyzed_ruby,
      erb_node->prism_node,
      locals,
      erb_node->base.location.start,
      erb_node->base.location.end,
      errors,
      allocator
    );
  }

  const char* params_close = find_params_close(params_open);

  size_t content_length = (size_t) erb_node->content->value.length;
  size_t params_open_offset = (size_t) (params_open - content_bytes);

  size_t params_length = params_close ? (size_t) (params_close - params_open) + 1 : content_length - params_open_offset;

  hb_buffer_T synthetic_buffer;
  if (!build_synthetic_ruby(params_open, params_length, &synthetic_buffer, allocator)) { return NULL; }

  pm_parser_t parser;
  pm_options_t options = { 0 };
  pm_parser_init(
    &parser,
    (const uint8_t*) hb_buffer_value(&synthetic_buffer),
    hb_buffer_length(&synthetic_buffer),
    &options
  );
  pm_node_t* root = pm_parse(&parser);

  const uint8_t* synthetic_start = parser.start;

  pm_parameters_node_t* params_node = find_parameters_node(root);
  size_t erb_content_byte_offset = calculate_byte_offset_from_position(source, erb_node->content->location.start);
  hb_array_T* errors = hb_array_init(0, allocator);

  size_t params_in_content = (size_t) (params_open - content_bytes);
  size_t prefix_length = strlen(SYNTHETIC_PREFIX);

  for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) parser.error_list.head; error != NULL;
       error = (const pm_diagnostic_t*) error->node.next) {
    if (error->diag_id == PM_ERR_DEF_TERM) { continue; }

    size_t error_start_in_synthetic = (size_t) (error->location.start - synthetic_start);
    size_t error_end_in_synthetic = (size_t) (error->location.end - synthetic_start);

    size_t error_content_start =
      params_in_content + (error_start_in_synthetic > prefix_length ? error_start_in_synthetic - prefix_length : 0);
    size_t error_content_end =
      params_in_content + (error_end_in_synthetic > prefix_length ? error_end_in_synthetic - prefix_length : 0);

    position_T error_start = byte_offset_to_position(source, erb_content_byte_offset + error_content_start);
    position_T error_end = byte_offset_to_position(source, erb_content_byte_offset + error_content_end);

    RUBY_PARSE_ERROR_T* parse_error =
      ruby_parse_error_from_prism_error_with_positions(error, error_start, error_end, allocator);

    hb_array_append(errors, parse_error);
  }

  hb_array_T* locals;

  if (hb_array_size(errors) > 0) {
    locals = hb_array_init(0, allocator);
  } else {
    locals = extract_strict_locals(
      params_node,
      source,
      erb_content_byte_offset,
      content_bytes,
      params_open,
      synthetic_start,
      errors,
      allocator
    );
  }

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);
  pm_options_free(&options);
  hb_buffer_free(&synthetic_buffer);

  return ast_erb_strict_locals_node_init(
    erb_node->tag_opening,
    erb_node->content,
    erb_node->tag_closing,
    erb_node->analyzed_ruby,
    erb_node->prism_node,
    locals,
    erb_node->base.location.start,
    erb_node->base.location.end,
    errors,
    allocator
  );
}

static void transform_strict_locals_in_array(hb_array_T* array, analyze_ruby_context_T* context) {
  if (!array) { return; }

  for (size_t index = 0; index < hb_array_size(array); index++) {
    AST_NODE_T* child = hb_array_get(array, index);
    if (!child || child->type != AST_ERB_CONTENT_NODE) { continue; }

    AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) child;

    if (!is_strict_locals_node(erb_node)) { continue; }

    AST_ERB_STRICT_LOCALS_NODE_T* strict_locals_node =
      create_strict_locals_node(erb_node, context->source, context->allocator);

    if (!strict_locals_node) { continue; }

    if (context->found_strict_locals) {
      append_strict_locals_duplicate_declaration_error(
        strict_locals_node->base.location.start,
        strict_locals_node->base.location.end,
        context->allocator,
        strict_locals_node->base.errors
      );
    }

    context->found_strict_locals = true;
    hb_array_set(array, index, strict_locals_node);
  }
}

static void transform_strict_locals_in_node(const AST_NODE_T* node, analyze_ruby_context_T* context) {
  if (!node || !context) { return; }

  transform_strict_locals_in_array(get_node_children_array(node), context);
}

bool transform_strict_locals_nodes(const AST_NODE_T* node, void* data) {
  analyze_ruby_context_T* context = (analyze_ruby_context_T*) data;

  transform_strict_locals_in_node(node, context);

  herb_visit_child_nodes(node, transform_strict_locals_nodes, data);

  return false;
}
