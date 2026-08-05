#ifndef ATTRIBUTE_EXTRACTION_HELPERS_H
#define ATTRIBUTE_EXTRACTION_HELPERS_H

#include "../../lib/hb_allocator.h"
#include "tag_helper_handler.h"
#include "tag_helpers.h"

#include <prism.h>

AST_HTML_ATTRIBUTE_NODE_T* extract_html_attribute_from_assoc(
  pm_assoc_node_t* assoc,
  const uint8_t* source,
  const char* original_source,
  size_t erb_content_offset,
  hb_allocator_T* allocator
);

hb_array_T* extract_html_attributes_from_keyword_hash(
  pm_keyword_hash_node_t* kw_hash,
  const uint8_t* source,
  const char* original_source,
  size_t erb_content_offset,
  hb_allocator_T* allocator
);

void resolve_nonce_attribute(hb_array_T* attributes, hb_allocator_T* allocator);

bool has_html_attributes_in_call(pm_call_node_t* call_node);

hb_array_T* extract_html_attributes_from_call_node(
  pm_call_node_t* call_node,
  const uint8_t* source,
  const char* original_source,
  size_t erb_content_offset,
  hb_allocator_T* allocator
);

#endif
