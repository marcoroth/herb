#ifndef HERB_ANALYZE_H
#define HERB_ANALYZE_H

#include "../ast/ast_nodes.h"
#include "../lib/hb_allocator.h"
#include "../lib/hb_array.h"
#include "../lib/hb_buffer.h"
#include "../parser/parser.h"
#include "analyzed_ruby.h"

typedef struct TAG_HELPER_SCOPE_STRUCT {
  hb_buffer_T buffer;
  pm_options_t options;
  pm_parser_t parser;
  pm_node_t* root;
} tag_helper_scope_T;

typedef struct ANALYZE_RUBY_CONTEXT_STRUCT {
  AST_DOCUMENT_NODE_T* document;
  AST_NODE_T* parent;
  hb_array_T* ruby_context_stack;
  tag_helper_scope_T* tag_helper_scope;
  hb_allocator_T* allocator;
  const char* source;
  bool found_strict_locals;
  const parser_options_T* options;
} analyze_ruby_context_T;

typedef struct {
  int loop_depth;
  int rescue_depth;
  hb_allocator_T* allocator;
  const parser_options_T* options;
} invalid_erb_context_T;

void herb_analyze_parse_errors(
  AST_DOCUMENT_NODE_T* document,
  const char* source,
  const parser_options_T* options,
  hb_allocator_T* allocator
);
void herb_analyze_parse_tree(
  AST_DOCUMENT_NODE_T* document,
  const char* source,
  const parser_options_T* options,
  hb_allocator_T* allocator
);

hb_array_T* get_node_children_array(const AST_NODE_T* node);
hb_array_T* rewrite_node_array(AST_NODE_T* node, hb_array_T* array, analyze_ruby_context_T* context);
bool transform_erb_nodes(const AST_NODE_T* node, void* data);

#endif
