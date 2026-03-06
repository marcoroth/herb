#ifndef HERB_ANALYZE_CONDITIONAL_OPEN_TAGS_H
#define HERB_ANALYZE_CONDITIONAL_OPEN_TAGS_H

#include "../ast_nodes.h"
#include "../util/hb_allocator.h"

void herb_transform_conditional_open_tags(AST_DOCUMENT_NODE_T* document, hb_allocator_T* allocator);

#endif
