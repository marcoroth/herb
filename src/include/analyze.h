#ifndef HERB_ANALYZE_H
#define HERB_ANALYZE_H

#include "analyzed_ruby_struct.h"
#include "array.h"
#include "ast_nodes.h"

typedef struct ANALYZE_RUBY_CONTEXT_STRUCT {
  AST_DOCUMENT_NODE_T* document;
  AST_NODE_T* parent;
  array_T* ruby_context_stack;
} analyze_ruby_context_T;

void herb_analyze_parse_tree(AST_DOCUMENT_NODE_T* document);

#endif
