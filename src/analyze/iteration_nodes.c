#include "../include/analyze/iteration_nodes.h"
#include "../include/analyze/action_view/tag_helper_node_builders.h"
#include "../include/analyze/action_view/tag_helpers.h"
#include "../include/analyze/analyze.h"
#include "../include/ast/ast_nodes.h"
#include "../include/lib/hb_allocator.h"
#include "../include/lib/hb_array.h"
#include "../include/lib/hb_string.h"
#include "../include/visitor.h"

#include <prism.h>
#include <stdbool.h>
#include <string.h>

static token_T* create_token_from_prism_location(
  pm_location_t location,
  token_type_T type,
  const char* source,
  size_t erb_content_offset,
  const uint8_t* erb_content_source,
  hb_allocator_T* allocator
) {
  if (location.start == NULL || location.end == NULL) { return NULL; }
  if (!source || !erb_content_source) { return NULL; }

  size_t length = (size_t) (location.end - location.start);
  char* value = hb_allocator_strndup(allocator, (const char*) location.start, length);

  size_t total_start = erb_content_offset + (size_t) (location.start - erb_content_source);
  size_t total_end = erb_content_offset + (size_t) (location.end - erb_content_source);

  position_T start = byte_offset_to_position(source, total_start);
  position_T end = byte_offset_to_position(source, total_end);

  return create_synthetic_token(allocator, value, type, start, end);
}

/**
 * Collect the call arguments, e.g. the `3` in `each_slice(3)` or the `10` and `2` in `step(10, 2)`.
 *
 * Returns an empty array for argument-less calls like `each`.
 */
static hb_array_T* extract_call_arguments(
  const pm_call_node_t* call,
  const char* source,
  size_t erb_content_offset,
  const uint8_t* erb_content_source,
  hb_allocator_T* allocator
) {
  hb_array_T* arguments = hb_array_init(0, allocator);

  if (call->arguments == NULL) { return arguments; }

  for (size_t index = 0; index < call->arguments->arguments.size; index++) {
    const pm_node_t* argument = call->arguments->arguments.nodes[index];
    if (!argument) { continue; }

    size_t length = (size_t) (argument->location.end - argument->location.start);
    char* value = hb_allocator_strndup(allocator, (const char*) argument->location.start, length);

    position_T start = { .line = 1, .column = 1 };
    position_T end = { .line = 1, .column = 1 };

    if (source && erb_content_source) {
      size_t total_start = erb_content_offset + (size_t) (argument->location.start - erb_content_source);
      size_t total_end = erb_content_offset + (size_t) (argument->location.end - erb_content_source);

      start = byte_offset_to_position(source, total_start);
      end = byte_offset_to_position(source, total_end);
    }

    AST_RUBY_LITERAL_NODE_T* literal =
      ast_ruby_literal_node_init(hb_string_from_c_string(value), start, end, hb_array_init(0, allocator), allocator);

    hb_array_append(arguments, literal);
    hb_allocator_dealloc(allocator, value);
  }

  return arguments;
}

// Whether a method repeats its block once per element. Iteration isn't statically decidable, so this is
// an allowlist: it deliberately excludes builder blocks like `form_with` that also take a block.
static const char* ITERATION_METHODS[] = {
  "each",
  "each_with_index",
  "each_with_object",
  "each_slice",
  "each_cons",
  "each_pair",
  "each_entry",
  "times",
  "upto",
  "downto",
  "step",
  "map",
  "flat_map",
  "select",
  "filter",
  "reject",
  "filter_map",
  "cycle",
};

static bool is_iteration_method(const pm_constant_t* constant) {
  size_t count = sizeof(ITERATION_METHODS) / sizeof(ITERATION_METHODS[0]);

  for (size_t index = 0; index < count; index++) {
    const char* name = ITERATION_METHODS[index];
    size_t length = strlen(name);

    if (constant->length == length && memcmp(constant->start, name, length) == 0) { return true; }
  }

  return false;
}

static bool is_iteration_call(const pm_call_node_t* call, const pm_parser_t* parser) {
  if (!call) { return false; }
  if (call->receiver == NULL) { return false; }
  if (call->block == NULL || call->block->type != PM_BLOCK_NODE) { return false; }

  pm_constant_id_t name_id = call->name;
  const pm_constant_t* constant = pm_constant_pool_id_to_constant(&((pm_parser_t*) parser)->constant_pool, name_id);

  if (!constant) { return false; }

  return is_iteration_method(constant);
}

static pm_call_node_t* find_iteration_call(pm_node_t* node, const pm_parser_t* parser) {
  if (!node) { return NULL; }

  if (node->type == PM_PROGRAM_NODE) {
    pm_program_node_t* program = (pm_program_node_t*) node;

    if (program->statements && program->statements->body.size > 0) {
      return find_iteration_call((pm_node_t*) program->statements->body.nodes[0], parser);
    }

    return NULL;
  }

  if (node->type == PM_STATEMENTS_NODE) {
    pm_statements_node_t* statements = (pm_statements_node_t*) node;

    if (statements->body.size > 0) { return find_iteration_call((pm_node_t*) statements->body.nodes[0], parser); }

    return NULL;
  }

  if (node->type == PM_CALL_NODE) {
    pm_call_node_t* call = (pm_call_node_t*) node;

    if (is_iteration_call(call, parser)) { return call; }
  }

  return NULL;
}

static AST_ERB_ITERATION_BLOCK_NODE_T* try_transform_block_node(
  AST_ERB_BLOCK_NODE_T* block_node,
  analyze_ruby_context_T* context
) {
  if (!block_node->content || hb_string_is_empty(block_node->content->value)) { return NULL; }

  hb_allocator_T* allocator = context->allocator;

  const char* ruby_source = block_node->content->value.data;
  size_t ruby_length = block_node->content->value.length;

  pm_parser_t parser;
  pm_parser_init(&parser, (const uint8_t*) ruby_source, ruby_length, NULL);
  pm_node_t* root = pm_parse(&parser);

  pm_call_node_t* iteration_call = find_iteration_call(root, &parser);

  if (!iteration_call) {
    pm_node_destroy(&parser, root);
    pm_parser_free(&parser);

    return NULL;
  }

  size_t erb_content_offset = 0;

  if (context->source) {
    erb_content_offset = calculate_byte_offset_from_position(context->source, block_node->content->location.start);
  }

  const uint8_t* erb_content_source = (const uint8_t*) parser.start;

  token_T* receiver = create_token_from_prism_location(
    iteration_call->receiver->location,
    TOKEN_ERB_CONTENT,
    context->source,
    erb_content_offset,
    erb_content_source,
    allocator
  );

  token_T* call_operator = create_token_from_prism_location(
    iteration_call->call_operator_loc,
    TOKEN_IDENTIFIER,
    context->source,
    erb_content_offset,
    erb_content_source,
    allocator
  );

  token_T* message = create_token_from_prism_location(
    iteration_call->message_loc,
    TOKEN_IDENTIFIER,
    context->source,
    erb_content_offset,
    erb_content_source,
    allocator
  );

  hb_array_T* arguments =
    extract_call_arguments(iteration_call, context->source, erb_content_offset, erb_content_source, allocator);

  pm_block_node_t* block = (pm_block_node_t*) iteration_call->block;

  token_T* block_opening = create_token_from_prism_location(
    block->opening_loc,
    TOKEN_IDENTIFIER,
    context->source,
    erb_content_offset,
    erb_content_source,
    allocator
  );

  hb_array_T* iteration_errors = block_node->base.errors;
  block_node->base.errors = NULL;

  AST_ERB_ITERATION_BLOCK_NODE_T* iteration_block_node = ast_erb_iteration_block_node_init(
    block_node->tag_opening,
    block_node->content,
    block_node->tag_closing,
    block_node->prism_node,
    receiver,
    call_operator,
    message,
    arguments,
    block_opening,
    block_node->body,
    block_node->block_arguments,
    block_node->rescue_clause,
    block_node->else_clause,
    block_node->ensure_clause,
    block_node->end_node,
    block_node->base.location.start,
    block_node->base.location.end,
    iteration_errors,
    allocator
  );

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);

  return iteration_block_node;
}

static void transform_iteration_nodes_in_array(hb_array_T* array, analyze_ruby_context_T* context) {
  if (!array) { return; }

  for (size_t index = 0; index < hb_array_size(array); index++) {
    AST_NODE_T* child = hb_array_get(array, index);
    if (!child) { continue; }
    if (child->type != AST_ERB_BLOCK_NODE) { continue; }

    AST_ERB_ITERATION_BLOCK_NODE_T* iteration_block_node =
      try_transform_block_node((AST_ERB_BLOCK_NODE_T*) child, context);

    if (iteration_block_node) { hb_array_set(array, index, iteration_block_node); }
  }
}

bool transform_iteration_nodes(const AST_NODE_T* node, void* data) {
  analyze_ruby_context_T* context = (analyze_ruby_context_T*) data;

  if (node && context) { transform_iteration_nodes_in_array(get_node_children_array(node), context); }

  herb_visit_child_nodes(node, transform_iteration_nodes, data);

  return false;
}
