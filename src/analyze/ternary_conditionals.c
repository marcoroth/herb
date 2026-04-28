#include "../include/analyze/ternary_conditionals.h"
#include "../include/analyze/action_view/tag_helper_node_builders.h"
#include "../include/analyze/analyze.h"
#include "../include/analyze/analyzed_ruby.h"
#include "../include/ast/ast_nodes.h"
#include "../include/lib/hb_allocator.h"
#include "../include/lib/hb_array.h"
#include "../include/lib/hb_string.h"
#include "../include/prism/herb_prism_node.h"
#include "../include/visitor.h"

#include <prism.h>
#include <stdbool.h>
#include <string.h>

static bool is_erb_output_tag(AST_ERB_CONTENT_NODE_T* erb_node) {
  if (!erb_node || !erb_node->tag_opening) { return false; }

  hb_string_T opening = erb_node->tag_opening->value;

  return opening.length >= 3 && opening.data[0] == '<' && opening.data[1] == '%' && opening.data[2] == '=';
}

static pm_node_t* find_ternary_statement(analyzed_ruby_T* analyzed) {
  if (!analyzed || !analyzed->valid || !analyzed->root) { return NULL; }

  if (analyzed->root->type != PM_PROGRAM_NODE) { return NULL; }
  pm_program_node_t* program = (pm_program_node_t*) analyzed->root;

  if (!program->statements || program->statements->body.size != 1) { return NULL; }
  pm_node_t* statement = program->statements->body.nodes[0];

  if (statement->type != PM_IF_NODE) { return NULL; }
  pm_if_node_t* if_node = (pm_if_node_t*) statement;

  if (if_node->if_keyword_loc.start == NULL && if_node->subsequent != NULL) { return statement; }

  return NULL;
}

typedef struct {
  char* source;
  size_t offset_in_content;
  size_t length;
} body_info_T;

static body_info_T extract_statements_body_info(
  pm_statements_node_t* statements,
  analyzed_ruby_T* analyzed,
  hb_allocator_T* allocator
) {
  body_info_T info = { .source = NULL, .offset_in_content = 0, .length = 0 };

  if (!statements || statements->body.size == 0) { return info; }

  pm_node_t* first = statements->body.nodes[0];
  pm_node_t* last = statements->body.nodes[statements->body.size - 1];

  const uint8_t* start = first->location.start;
  const uint8_t* end = last->location.end;

  const uint8_t* parser_start = analyzed->parser.start;
  size_t source_length = (size_t) (analyzed->parser.end - parser_start);

  if (start < parser_start || end > parser_start + source_length) { return info; }

  const uint8_t* body_start = start;
  const uint8_t* body_end = end;

  if (body_start > parser_start && *(body_start - 1) == ' ') { body_start--; }
  if (body_end < parser_start + source_length && *body_end == ' ') { body_end++; }

  info.offset_in_content = (size_t) (body_start - parser_start);
  info.length = (size_t) (body_end - body_start);
  info.source = hb_allocator_strndup(allocator, (const char*) body_start, info.length);

  return info;
}

static char* extract_condition_source(pm_if_node_t* if_node, hb_allocator_T* allocator) {
  pm_node_t* predicate = if_node->predicate;

  if (!predicate) { return NULL; }

  size_t length = (size_t) (predicate->location.end - predicate->location.start);

  return hb_allocator_strndup(allocator, (const char*) predicate->location.start, length);
}

AST_NODE_T* transform_ternary_expression(
  AST_ERB_CONTENT_NODE_T* erb_node,
  pm_if_node_t* if_node,
  hb_allocator_T* allocator
) {
  body_info_T true_info = extract_statements_body_info(if_node->statements, erb_node->analyzed_ruby, allocator);
  if (!true_info.source) { return NULL; }

  pm_else_node_t* else_node = (pm_else_node_t*) if_node->subsequent;
  if (!else_node) { return NULL; }

  body_info_T false_info = extract_statements_body_info(else_node->statements, erb_node->analyzed_ruby, allocator);
  if (!false_info.source) { return NULL; }

  char* condition_source = extract_condition_source(if_node, allocator);
  if (!condition_source) { return NULL; }

  position_T start = erb_node->base.location.start;
  position_T end = erb_node->base.location.end;
  position_T content_start = erb_node->content->location.start;

  position_T true_content_start = { .line = content_start.line,
                                    .column = content_start.column + (uint32_t) true_info.offset_in_content };

  position_T true_content_end = { .line = content_start.line,
                                  .column = content_start.column
                                          + (uint32_t) (true_info.offset_in_content + true_info.length) };

  token_T* true_content =
    create_synthetic_token(allocator, true_info.source, TOKEN_ERB_CONTENT, true_content_start, true_content_end);

  AST_ERB_CONTENT_NODE_T* true_erb_node = ast_erb_content_node_init(
    erb_node->tag_opening,
    true_content,
    erb_node->tag_closing,
    NULL,
    false,
    true,
    HERB_PRISM_NODE_EMPTY,
    start,
    end,
    hb_array_init(0, allocator),
    allocator
  );

  if (!true_erb_node) { return NULL; }

  position_T false_content_start = { .line = content_start.line,
                                     .column = content_start.column + (uint32_t) false_info.offset_in_content };

  position_T false_content_end = { .line = content_start.line,
                                   .column = content_start.column
                                           + (uint32_t) (false_info.offset_in_content + false_info.length) };

  token_T* false_content =
    create_synthetic_token(allocator, false_info.source, TOKEN_ERB_CONTENT, false_content_start, false_content_end);

  AST_ERB_CONTENT_NODE_T* false_erb_node = ast_erb_content_node_init(
    erb_node->tag_opening,
    false_content,
    erb_node->tag_closing,
    NULL,
    false,
    true,
    HERB_PRISM_NODE_EMPTY,
    start,
    end,
    hb_array_init(0, allocator),
    allocator
  );

  if (!false_erb_node) { return NULL; }

  hb_array_T* true_statements = hb_array_init(1, allocator);
  hb_array_T* false_statements = hb_array_init(1, allocator);

  hb_array_append(true_statements, (AST_NODE_T*) true_erb_node);
  hb_array_append(false_statements, (AST_NODE_T*) false_erb_node);

  token_T* else_opening = create_synthetic_token(allocator, "<%", TOKEN_ERB_START, end, end);
  token_T* else_content_token = create_synthetic_token(allocator, " else ", TOKEN_ERB_CONTENT, end, end);
  token_T* else_closing = create_synthetic_token(allocator, "%>", TOKEN_ERB_END, end, end);

  AST_ERB_ELSE_NODE_T* erb_else_node = ast_erb_else_node_init(
    else_opening,
    else_content_token,
    else_closing,
    false_statements,
    end,
    end,
    hb_array_init(0, allocator),
    allocator
  );

  hb_buffer_T condition_buffer;
  hb_buffer_init(&condition_buffer, 64, allocator);
  hb_buffer_append(&condition_buffer, " if ");
  hb_buffer_append(&condition_buffer, condition_source);
  hb_buffer_append(&condition_buffer, " ");

  const char* condition_content = hb_buffer_value(&condition_buffer);

  token_T* if_opening = create_synthetic_token(allocator, "<%", TOKEN_ERB_START, start, start);
  token_T* if_content = create_synthetic_token(allocator, condition_content, TOKEN_ERB_CONTENT, start, end);
  token_T* if_closing = create_synthetic_token(allocator, "%>", TOKEN_ERB_END, end, end);

  token_T* end_opening = create_synthetic_token(allocator, "<%", TOKEN_ERB_START, end, end);
  token_T* end_content = create_synthetic_token(allocator, " end ", TOKEN_ERB_CONTENT, end, end);
  token_T* end_closing = create_synthetic_token(allocator, "%>", TOKEN_ERB_END, end, end);

  AST_ERB_END_NODE_T* end_node =
    ast_erb_end_node_init(end_opening, end_content, end_closing, end, end, hb_array_init(0, allocator), allocator);

  herb_prism_node_T empty_prism_node = HERB_PRISM_NODE_EMPTY;

  AST_ERB_IF_NODE_T* result_if_node = ast_erb_if_node_init(
    if_opening,
    if_content,
    if_closing,
    NULL,
    empty_prism_node,
    true_statements,
    (AST_NODE_T*) erb_else_node,
    end_node,
    start,
    end,
    hb_array_init(0, allocator),
    allocator
  );

  return (AST_NODE_T*) result_if_node;
}

static void transform_ternary_array(hb_array_T* array, analyze_ruby_context_T* context) {
  if (!array || !context) { return; }

  for (size_t i = 0; i < hb_array_size(array); i++) {
    AST_NODE_T* child = hb_array_get(array, i);
    if (!child) { continue; }
    if (child->type != AST_ERB_CONTENT_NODE) { continue; }

    AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) child;
    if (!is_erb_output_tag(erb_node)) { continue; }
    if (!erb_node->analyzed_ruby) { continue; }

    pm_node_t* ternary_node = find_ternary_statement(erb_node->analyzed_ruby);
    if (!ternary_node) { continue; }

    AST_NODE_T* replacement = transform_ternary_expression(erb_node, (pm_if_node_t*) ternary_node, context->allocator);
    if (replacement) { hb_array_set(array, i, replacement); }
  }
}

static void transform_ternary_blocks(const AST_NODE_T* node, analyze_ruby_context_T* context) {
  if (!node || !context) { return; }

  switch (node->type) {
    case AST_DOCUMENT_NODE: transform_ternary_array(((AST_DOCUMENT_NODE_T*) node)->children, context); break;
    case AST_HTML_ELEMENT_NODE: transform_ternary_array(((AST_HTML_ELEMENT_NODE_T*) node)->body, context); break;
    case AST_HTML_OPEN_TAG_NODE: transform_ternary_array(((AST_HTML_OPEN_TAG_NODE_T*) node)->children, context); break;
    case AST_HTML_ATTRIBUTE_VALUE_NODE:
      transform_ternary_array(((AST_HTML_ATTRIBUTE_VALUE_NODE_T*) node)->children, context);
      break;
    default: break;
  }
}

bool transform_ternary_conditional_nodes(const AST_NODE_T* node, void* data) {
  analyze_ruby_context_T* context = (analyze_ruby_context_T*) data;

  transform_ternary_blocks(node, context);

  herb_visit_child_nodes(node, transform_ternary_conditional_nodes, data);

  return false;
}
