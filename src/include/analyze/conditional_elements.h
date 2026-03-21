#ifndef HERB_ANALYZE_CONDITIONAL_ELEMENTS_H
#define HERB_ANALYZE_CONDITIONAL_ELEMENTS_H

#include "../ast/ast_nodes.h"
#include "../lib/hb_allocator.h"

void herb_transform_conditional_elements(AST_DOCUMENT_NODE_T* document, hb_allocator_T* allocator);

#endif
