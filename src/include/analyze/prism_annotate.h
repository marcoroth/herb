#ifndef HERB_PRISM_ANNOTATE_H
#define HERB_PRISM_ANNOTATE_H

#include "../ast_nodes.h"
#include "../util/hb_allocator.h"

void herb_annotate_prism_nodes(
  AST_DOCUMENT_NODE_T* document,
  const char* source,
  bool prism_nodes,
  bool prism_nodes_deep,
  bool prism_program,
  hb_allocator_T* allocator
);

#endif
