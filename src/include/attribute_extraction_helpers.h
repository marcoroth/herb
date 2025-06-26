#ifndef ATTRIBUTE_EXTRACTION_HELPERS_H
#define ATTRIBUTE_EXTRACTION_HELPERS_H

#include "analyze_tag_helpers.h"
#include "tag_helper_handler.h"

#include <prism.h>

AST_HTML_ATTRIBUTE_NODE_T* extract_html_attribute_from_assoc(
  pm_assoc_node_t* assoc, const uint8_t* source, const char* original_source, size_t erb_content_offset
);

array_T* extract_html_attributes_from_keyword_hash(
  pm_keyword_hash_node_t* kw_hash, const uint8_t* source, const char* original_source, size_t erb_content_offset
);

bool has_html_attributes_in_call(pm_call_node_t* call_node);

array_T* extract_html_attributes_from_call_node(
  pm_call_node_t* call_node, const uint8_t* source, const char* original_source, size_t erb_content_offset
);

#endif
