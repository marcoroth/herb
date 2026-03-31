#include "../include/analyze/postfix_conditionals.h"
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

static pm_node_t* find_postfix_conditional_statement(analyzed_ruby_T* analyzed) {
  if (!analyzed || !analyzed->valid || !analyzed->root) { return NULL; }

  if (analyzed->root->type != PM_PROGRAM_NODE) { return NULL; }
  pm_program_node_t* program = (pm_program_node_t*) analyzed->root;

  if (!program->statements || program->statements->body.size != 1) { return NULL; }
  pm_node_t* statement = program->statements->body.nodes[0];

  if (statement->type == PM_IF_NODE) {
    pm_if_node_t* if_node = (pm_if_node_t*) statement;

    if (if_node->if_keyword_loc.start != NULL && if_node->end_keyword_loc.start == NULL) { return statement; }
  } else if (statement->type == PM_UNLESS_NODE) {
    pm_unless_node_t* unless_node = (pm_unless_node_t*) statement;

    if (unless_node->keyword_loc.start != NULL && unless_node->end_keyword_loc.start == NULL) { return statement; }
  }

  return NULL;
}

static char* extract_body_source(pm_node_t* conditional_node, analyzed_ruby_T* analyzed, hb_allocator_T* allocator) {
  pm_statements_node_t* statements = NULL;

  if (conditional_node->type == PM_IF_NODE) {
    statements = ((pm_if_node_t*) conditional_node)->statements;
  } else if (conditional_node->type == PM_UNLESS_NODE) {
    statements = ((pm_unless_node_t*) conditional_node)->statements;
  }

  if (!statements || statements->body.size == 0) { return NULL; }

  pm_node_t* first = statements->body.nodes[0];
  pm_node_t* last = statements->body.nodes[statements->body.size - 1];

  const uint8_t* start = first->location.start;
  const uint8_t* end = last->location.end;
  size_t length = (size_t) (end - start);

  const uint8_t* parser_start = analyzed->parser.start;
  size_t source_length = (size_t) (analyzed->parser.end - parser_start);

  if (start < parser_start || end > parser_start + source_length) { return NULL; }

  return hb_allocator_strndup(allocator, (const char*) start, length);
}

static char* extract_condition_source(pm_node_t* conditional_node, hb_allocator_T* allocator) {
  pm_node_t* predicate = NULL;

  if (conditional_node->type == PM_IF_NODE) {
    predicate = ((pm_if_node_t*) conditional_node)->predicate;
  } else if (conditional_node->type == PM_UNLESS_NODE) {
    predicate = ((pm_unless_node_t*) conditional_node)->predicate;
  }

  if (!predicate) { return NULL; }

  size_t length = (size_t) (predicate->location.end - predicate->location.start);

  return hb_allocator_strndup(allocator, (const char*) predicate->location.start, length);
}

static const char* condition_keyword(pm_node_t* conditional_node) {
  if (conditional_node->type == PM_IF_NODE) { return "if"; }
  if (conditional_node->type == PM_UNLESS_NODE) { return "unless"; }

  return NULL;
}

static AST_NODE_T* transform_conditional(
  AST_ERB_CONTENT_NODE_T* erb_node,
  pm_node_t* conditional_node,
  hb_allocator_T* allocator
) {
  char* body_source = extract_body_source(conditional_node, erb_node->analyzed_ruby, allocator);
  if (!body_source) { return NULL; }

  char* condition_source = extract_condition_source(conditional_node, allocator);
  if (!condition_source) { return NULL; }

  const char* keyword = condition_keyword(conditional_node);
  if (!keyword) { return NULL; }

  position_T start = erb_node->base.location.start;
  position_T end = erb_node->base.location.end;

  token_T* body_opening = create_synthetic_token(allocator, "<%=", TOKEN_ERB_START, start, start);
  token_T* body_content = create_synthetic_token(allocator, body_source, TOKEN_ERB_CONTENT, start, end);
  token_T* body_closing = create_synthetic_token(allocator, "%>", TOKEN_ERB_END, end, end);

  AST_ERB_CONTENT_NODE_T* body_erb_node = ast_erb_content_node_init(
    body_opening,
    body_content,
    body_closing,
    NULL,
    false,
    true,
    HERB_PRISM_NODE_EMPTY,
    start,
    end,
    hb_array_init(0, allocator),
    allocator
  );

  if (!body_erb_node) { return NULL; }

  hb_array_T* statements = hb_array_init(1, allocator);
  hb_array_append(statements, (AST_NODE_T*) body_erb_node);

  hb_buffer_T condition_buffer;
  hb_buffer_init(&condition_buffer, 64, allocator);
  hb_buffer_append(&condition_buffer, " ");
  hb_buffer_append(&condition_buffer, keyword);
  hb_buffer_append(&condition_buffer, " ");
  hb_buffer_append(&condition_buffer, condition_source);
  hb_buffer_append(&condition_buffer, " ");

  const char* condition_content = hb_buffer_value(&condition_buffer);

  token_T* tag_opening = create_synthetic_token(allocator, "<%", TOKEN_ERB_START, start, start);
  token_T* content_token = create_synthetic_token(allocator, condition_content, TOKEN_ERB_CONTENT, start, end);
  token_T* tag_closing = create_synthetic_token(allocator, "%>", TOKEN_ERB_END, end, end);

  token_T* end_opening = create_synthetic_token(allocator, "<%", TOKEN_ERB_START, end, end);
  token_T* end_content = create_synthetic_token(allocator, " end ", TOKEN_ERB_CONTENT, end, end);
  token_T* end_closing = create_synthetic_token(allocator, "%>", TOKEN_ERB_END, end, end);

  AST_ERB_END_NODE_T* end_node =
    ast_erb_end_node_init(end_opening, end_content, end_closing, end, end, hb_array_init(0, allocator), allocator);

  herb_prism_node_T empty_prism_node = HERB_PRISM_NODE_EMPTY;

  if (conditional_node->type == PM_IF_NODE) {
    AST_ERB_IF_NODE_T* if_node = ast_erb_if_node_init(
      tag_opening,
      content_token,
      tag_closing,
      NULL,
      empty_prism_node,
      statements,
      NULL,
      end_node,
      start,
      end,
      hb_array_init(0, allocator),
      allocator
    );

    return (AST_NODE_T*) if_node;
  } else {
    AST_ERB_UNLESS_NODE_T* unless_node = ast_erb_unless_node_init(
      tag_opening,
      content_token,
      tag_closing,
      NULL,
      empty_prism_node,
      statements,
      NULL,
      end_node,
      start,
      end,
      hb_array_init(0, allocator),
      allocator
    );

    return (AST_NODE_T*) unless_node;
  }
}

static void transform_conditional_array(hb_array_T* array, analyze_ruby_context_T* context) {
  if (!array || !context) { return; }

  for (size_t i = 0; i < hb_array_size(array); i++) {
    AST_NODE_T* child = hb_array_get(array, i);
    if (!child) { continue; }
    if (child->type != AST_ERB_CONTENT_NODE) { continue; }

    AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) child;
    if (!is_erb_output_tag(erb_node)) { continue; }
    if (!erb_node->analyzed_ruby) { continue; }

    pm_node_t* conditional_node = find_postfix_conditional_statement(erb_node->analyzed_ruby);
    if (!conditional_node) { continue; }

    AST_NODE_T* replacement = transform_conditional(erb_node, conditional_node, context->allocator);
    if (replacement) { hb_array_set(array, i, replacement); }
  }
}

static void transform_conditional_blocks(const AST_NODE_T* node, analyze_ruby_context_T* context) {
  if (!node || !context) { return; }

  switch (node->type) {
    case AST_DOCUMENT_NODE: transform_conditional_array(((AST_DOCUMENT_NODE_T*) node)->children, context); break;
    case AST_HTML_ELEMENT_NODE: transform_conditional_array(((AST_HTML_ELEMENT_NODE_T*) node)->body, context); break;
    case AST_HTML_OPEN_TAG_NODE:
      transform_conditional_array(((AST_HTML_OPEN_TAG_NODE_T*) node)->children, context);
      break;
    case AST_HTML_ATTRIBUTE_VALUE_NODE:
      transform_conditional_array(((AST_HTML_ATTRIBUTE_VALUE_NODE_T*) node)->children, context);
      break;
    default: break;
  }
}

bool transform_conditional_nodes(const AST_NODE_T* node, void* data) {
  analyze_ruby_context_T* context = (analyze_ruby_context_T*) data;

  transform_conditional_blocks(node, context);

  herb_visit_child_nodes(node, transform_conditional_nodes, data);

  return false;
}
