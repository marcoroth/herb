#include "../include/analyze/each_nodes.h"
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

static bool is_each_call(const pm_call_node_t* call, const pm_parser_t* parser) {
  if (!call) { return false; }
  if (call->receiver == NULL) { return false; }
  if (call->block == NULL || call->block->type != PM_BLOCK_NODE) { return false; }

  pm_constant_id_t name_id = call->name;
  const pm_constant_t* constant = pm_constant_pool_id_to_constant(&((pm_parser_t*) parser)->constant_pool, name_id);

  if (!constant) { return false; }
  if (constant->length != 4) { return false; }

  return memcmp(constant->start, "each", 4) == 0;
}

/**
 * Find the `receiver.each do |...|` call that opens this ERB tag.
 *
 * Only the first statement is considered, and only when the `each` call is the statement itself,
 * so `<% @users.each do |user| %>` matches but `<% x = @users.each do |user| %>` doesn't.
 */
static pm_call_node_t* find_each_call(pm_node_t* node, const pm_parser_t* parser) {
  if (!node) { return NULL; }

  if (node->type == PM_PROGRAM_NODE) {
    pm_program_node_t* program = (pm_program_node_t*) node;

    if (program->statements && program->statements->body.size > 0) {
      return find_each_call((pm_node_t*) program->statements->body.nodes[0], parser);
    }

    return NULL;
  }

  if (node->type == PM_STATEMENTS_NODE) {
    pm_statements_node_t* statements = (pm_statements_node_t*) node;

    if (statements->body.size > 0) { return find_each_call((pm_node_t*) statements->body.nodes[0], parser); }

    return NULL;
  }

  if (node->type == PM_CALL_NODE) {
    pm_call_node_t* call = (pm_call_node_t*) node;

    if (is_each_call(call, parser)) { return call; }
  }

  return NULL;
}

static AST_ERB_EACH_BLOCK_NODE_T* try_transform_block_node(
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

  pm_call_node_t* each_call = find_each_call(root, &parser);

  if (!each_call) {
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
    each_call->receiver->location,
    TOKEN_ERB_CONTENT,
    context->source,
    erb_content_offset,
    erb_content_source,
    allocator
  );

  token_T* call_operator = create_token_from_prism_location(
    each_call->call_operator_loc,
    TOKEN_IDENTIFIER,
    context->source,
    erb_content_offset,
    erb_content_source,
    allocator
  );

  token_T* message = create_token_from_prism_location(
    each_call->message_loc,
    TOKEN_IDENTIFIER,
    context->source,
    erb_content_offset,
    erb_content_source,
    allocator
  );

  pm_block_node_t* block = (pm_block_node_t*) each_call->block;

  token_T* block_opening = create_token_from_prism_location(
    block->opening_loc,
    TOKEN_IDENTIFIER,
    context->source,
    erb_content_offset,
    erb_content_source,
    allocator
  );

  hb_array_T* each_errors = block_node->base.errors;
  block_node->base.errors = NULL;

  AST_ERB_EACH_BLOCK_NODE_T* each_block_node = ast_erb_each_block_node_init(
    block_node->tag_opening,
    block_node->content,
    block_node->tag_closing,
    block_node->prism_node,
    receiver,
    call_operator,
    message,
    block_opening,
    block_node->body,
    block_node->block_arguments,
    block_node->rescue_clause,
    block_node->else_clause,
    block_node->ensure_clause,
    block_node->end_node,
    block_node->base.location.start,
    block_node->base.location.end,
    each_errors,
    allocator
  );

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);

  return each_block_node;
}

static void transform_each_nodes_in_array(hb_array_T* array, analyze_ruby_context_T* context) {
  if (!array) { return; }

  for (size_t index = 0; index < hb_array_size(array); index++) {
    AST_NODE_T* child = hb_array_get(array, index);
    if (!child) { continue; }
    if (child->type != AST_ERB_BLOCK_NODE) { continue; }

    AST_ERB_EACH_BLOCK_NODE_T* each_block_node = try_transform_block_node((AST_ERB_BLOCK_NODE_T*) child, context);

    if (each_block_node) { hb_array_set(array, index, each_block_node); }
  }
}

bool transform_each_nodes(const AST_NODE_T* node, void* data) {
  analyze_ruby_context_T* context = (analyze_ruby_context_T*) data;

  if (node && context) { transform_each_nodes_in_array(get_node_children_array(node), context); }

  herb_visit_child_nodes(node, transform_each_nodes, data);

  return false;
}
