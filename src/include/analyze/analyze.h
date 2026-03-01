#ifndef HERB_ANALYZE_H
#define HERB_ANALYZE_H

#include "analyzed_ruby.h"
#include "../ast_nodes.h"
#include "../util/hb_array.h"

typedef struct ANALYZE_RUBY_CONTEXT_STRUCT {
  AST_DOCUMENT_NODE_T* document;
  AST_NODE_T* parent;
  hb_array_T* ruby_context_stack;
} analyze_ruby_context_T;

typedef enum {
  CONTROL_TYPE_IF,
  CONTROL_TYPE_ELSIF,
  CONTROL_TYPE_ELSE,
  CONTROL_TYPE_END,
  CONTROL_TYPE_CASE,
  CONTROL_TYPE_CASE_MATCH,
  CONTROL_TYPE_WHEN,
  CONTROL_TYPE_IN,
  CONTROL_TYPE_BEGIN,
  CONTROL_TYPE_RESCUE,
  CONTROL_TYPE_ENSURE,
  CONTROL_TYPE_UNLESS,
  CONTROL_TYPE_WHILE,
  CONTROL_TYPE_UNTIL,
  CONTROL_TYPE_FOR,
  CONTROL_TYPE_BLOCK,
  CONTROL_TYPE_BLOCK_CLOSE,
  CONTROL_TYPE_YIELD,
  CONTROL_TYPE_UNKNOWN
} control_type_t;

typedef struct {
  int loop_depth;
  int rescue_depth;
} invalid_erb_context_T;

void herb_analyze_parse_errors(AST_DOCUMENT_NODE_T* document, const char* source);
void herb_analyze_parse_tree(AST_DOCUMENT_NODE_T* document, const char* source, bool strict);

hb_array_T* rewrite_node_array(AST_NODE_T* node, hb_array_T* array, analyze_ruby_context_T* context);
bool transform_erb_nodes(const AST_NODE_T* node, void* data);

#endif
