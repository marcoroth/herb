#include "../include/tag_helper_handler.h"

#include <stdbool.h>
#include <stdlib.h>

extern tag_helper_handler_T content_tag_handler;
extern tag_helper_handler_T tag_dot_handler;
extern tag_helper_handler_T link_to_handler;

static size_t handlers_count = 3;

tag_helper_info_T* tag_helper_info_init(void) {
  tag_helper_info_T* info = calloc(1, sizeof(tag_helper_info_T));

  if (info) {
    info->tag_name = NULL;
    info->call_node = NULL;
    info->attributes = NULL;
    info->content = NULL;
    info->has_block = false;
  }

  return info;
}

void tag_helper_info_free(tag_helper_info_T** info) {
  if (!info || !*info) { return; }

  if ((*info)->tag_name) { free((*info)->tag_name); }
  if ((*info)->content) { free((*info)->content); }
  if ((*info)->attributes) { array_free(&(*info)->attributes); }

  free(*info);

  *info = NULL;
}

tag_helper_handler_T* get_tag_helper_handlers(void) {
  static tag_helper_handler_T static_handlers[3];
  static bool initialized = false;

  if (!initialized) {
    static_handlers[0] = content_tag_handler;
    static_handlers[1] = tag_dot_handler;
    static_handlers[2] = link_to_handler;
    initialized = true;
  }

  return static_handlers;
}

size_t get_tag_helper_handlers_count(void) {
  return handlers_count;
}
