#ifndef HERB_ANALYZE_H
#define HERB_ANALYZE_H

#include "analyzed_ruby.h"
#include "array.h"
#include "ast_nodes.h"

typedef struct ANALYZE_RUBY_CONTEXT_STRUCT {
  AST_DOCUMENT_NODE_T* document;
  AST_NODE_T* parent;
  array_T* ruby_context_stack;
} analyze_ruby_context_T;

typedef enum {
  CONTROL_TYPE_IF,
  CONTROL_TYPE_ELSIF,
  CONTROL_TYPE_ELSE,
  CONTROL_TYPE_END,
  CONTROL_TYPE_CASE,
  CONTROL_TYPE_WHEN,
  CONTROL_TYPE_BEGIN,
  CONTROL_TYPE_RESCUE,
  CONTROL_TYPE_ENSURE,
  CONTROL_TYPE_UNLESS,
  CONTROL_TYPE_WHILE,
  CONTROL_TYPE_UNTIL,
  CONTROL_TYPE_FOR,
  CONTROL_TYPE_BLOCK,
  CONTROL_TYPE_BLOCK_CLOSE,
  CONTROL_TYPE_UNKNOWN
} control_type_t;

void herb_analyze_parse_errors(AST_DOCUMENT_NODE_T* document, const char* source);
void herb_analyze_parse_tree(AST_DOCUMENT_NODE_T* document, const char* source);

#endif
