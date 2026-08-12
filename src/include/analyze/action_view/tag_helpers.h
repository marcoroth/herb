#ifndef HERB_ANALYZE_TAG_HELPERS_H
#define HERB_ANALYZE_TAG_HELPERS_H

#include "../../ast/ast_nodes.h"
#include "../../lib/hb_array.h"
#include "../../location/position.h"
#include "../analyze.h"
#include "tag_helper_handler.h"

#include <prism.h>
#include <stdbool.h>

typedef struct {
  const pm_node_t* tag_helper_node;
  const uint8_t* source;
  pm_parser_t* parser;
  tag_helper_info_T* info;
  const tag_helper_handler_T* matched_handler;
  bool found;
} tag_helper_search_data_T;

bool search_tag_helper_node(const pm_node_t* node, void* data);

position_T prism_location_to_position_with_offset(
  const pm_location_t* pm_location,
  const char* original_source,
  size_t erb_content_offset,
  const uint8_t* erb_content_source
);

position_T byte_offset_to_position(const char* source, size_t offset);

size_t calculate_byte_offset_from_position(const char* source, position_T position);

void transform_tag_helper_blocks(const AST_NODE_T* node, analyze_ruby_context_T* context);
bool transform_tag_helper_nodes(const AST_NODE_T* node, void* data);

#endif
