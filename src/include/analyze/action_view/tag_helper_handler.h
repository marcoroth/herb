#ifndef TAG_HELPER_HANDLER_H
#define TAG_HELPER_HANDLER_H

#include "../../lib/hb_allocator.h"
#include "../../lib/hb_array.h"
#include "../../lib/hb_string.h"
#include <prism.h>
#include <stdbool.h>

typedef struct {
  char* tag_name;
  pm_call_node_t* call_node;
  hb_array_T* attributes;
  char* content;
  bool content_is_ruby_expression;
  bool has_block;
  hb_allocator_T* allocator;
} tag_helper_info_T;

typedef struct {
  const char* name;
  hb_string_T source;
  bool (*detect)(pm_call_node_t* call_node, pm_parser_t* parser);
  char* (*extract_tag_name)(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator);
  char* (*extract_content)(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator);
  hb_array_T* (*extract_attributes)(
    pm_call_node_t* call_node,
    const uint8_t* source,
    const char* original_source,
    size_t erb_content_offset
  );
  bool (*supports_block)(void);
} tag_helper_handler_T;

tag_helper_info_T* tag_helper_info_init(hb_allocator_T* allocator);
void tag_helper_info_free(tag_helper_info_T** info);

tag_helper_handler_T* get_tag_helper_handlers(void);
size_t get_tag_helper_handlers_count(void);

char* extract_inline_block_content(pm_call_node_t* call_node, hb_allocator_T* allocator);

struct AST_NODE_STRUCT;
bool wrap_javascript_tag_body_visitor(const struct AST_NODE_STRUCT* node, void* data);

#endif
