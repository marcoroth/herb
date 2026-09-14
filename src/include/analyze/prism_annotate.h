#ifndef HERB_PRISM_ANNOTATE_H
#define HERB_PRISM_ANNOTATE_H

#include "../ast/ast_nodes.h"
#include "../lib/hb_allocator.h"

struct PARSER_OPTIONS_STRUCT;

void herb_annotate_prism_nodes(
  AST_DOCUMENT_NODE_T* document,
  const char* source,
  const struct PARSER_OPTIONS_STRUCT* options,
  hb_allocator_T* allocator
);

#endif
