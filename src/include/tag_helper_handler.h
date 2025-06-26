#ifndef TAG_HELPER_HANDLER_H
#define TAG_HELPER_HANDLER_H

#include "array.h"
#include <prism.h>
#include <stdbool.h>

typedef struct {
  char* tag_name;
  pm_call_node_t* call_node;
  array_T* attributes;
  char* content;
  bool has_block;
} tag_helper_info_T;

typedef struct {
  const char* name;
  const char* source;
  bool (*detect)(pm_call_node_t* call_node, pm_parser_t* parser);
  char* (*extract_tag_name)(pm_call_node_t* call_node, pm_parser_t* parser);
  char* (*extract_content)(pm_call_node_t* call_node, pm_parser_t* parser);
  bool (*supports_block)(void);
} tag_helper_handler_T;

tag_helper_info_T* tag_helper_info_init(void);
void tag_helper_info_free(tag_helper_info_T** info);

tag_helper_handler_T* get_tag_helper_handlers(void);
size_t get_tag_helper_handlers_count(void);

#endif
