#ifndef HERB_ANALYZE_TAG_HELPERS_H
#define HERB_ANALYZE_TAG_HELPERS_H

#include "analyze.h"
#include "array.h"
#include "ast_nodes.h"
#include "position.h"
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

bool is_tag_helper_node(pm_node_t* node, const uint8_t* source);
bool is_tag_helper(const char* content);
bool is_tag_helper_block(const char* content, AST_ERB_CONTENT_NODE_T* erb_node);
bool has_tag_helper_attributes(const char* content);
bool has_tag_helper_block(AST_ERB_BLOCK_NODE_T* block_node);

char* extract_tag_name_from_call_node(pm_node_t* node, const uint8_t* source);
char* extract_tag_name_from_helper(const char* content);
char* extract_tag_helper_content(const char* content);

array_T* extract_keyword_arguments_from_call_node(
  pm_node_t* node, const uint8_t* source, const char* original_source, size_t erb_content_offset
);
array_T* extract_keyword_arguments_from_helper(
  const char* content, position_T* default_pos, const char* original_source, size_t erb_content_offset
);

AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_node(
  const char* name_string, const char* value_str, position_T* start_pos, position_T* end_pos
);
AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_from_assoc_node(
  struct pm_assoc_node* assoc, const char* name_string, const char* value_str, const char* original_source,
  size_t erb_content_offset, const uint8_t* source
);
AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_with_ruby_literal(
  const char* name_string, const char* ruby_content, position_T* start_pos, position_T* end_pos
);
AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_with_ruby_literal_from_assoc_node(
  struct pm_assoc_node* assoc, const char* name_string, const char* ruby_content, const char* original_source,
  size_t erb_content_offset, const uint8_t* source
);
AST_HTML_ATTRIBUTE_VALUE_NODE_T* create_interpolated_attribute_value(
  pm_interpolated_string_node_t* interpolated_node, position_T* start_pos, position_T* end_pos
);
AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_with_interpolated_value(
  const char* name_string, pm_interpolated_string_node_t* interpolated_node, position_T* start_pos, position_T* end_pos
);
AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_with_interpolated_value_from_assoc_node(
  struct pm_assoc_node* assoc, const char* name_string, pm_interpolated_string_node_t* interpolated_node,
  const char* original_source, size_t erb_content_offset, const uint8_t* source
);

AST_NODE_T* transform_tag_helper_with_attributes(AST_ERB_CONTENT_NODE_T* erb_node, analyze_ruby_context_T* context);
AST_NODE_T* transform_simple_tag_helper(AST_ERB_CONTENT_NODE_T* erb_node, analyze_ruby_context_T* context);
AST_NODE_T* transform_erb_block_to_tag_helper(AST_ERB_BLOCK_NODE_T* block_node, analyze_ruby_context_T* context);
AST_NODE_T* transform_link_to_helper(AST_ERB_CONTENT_NODE_T* erb_node, analyze_ruby_context_T* context);

bool search_tag_helper_node(const pm_node_t* node, void* data);

bool location_matches_tag(const uint8_t* source, pm_location_t loc);
bool location_matches_content_tag(const uint8_t* source, pm_location_t loc);

#endif
