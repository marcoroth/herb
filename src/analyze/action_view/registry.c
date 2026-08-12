#include "../../include/analyze/action_view/tag_helper_handler.h"
#include "../../include/lib/hb_allocator.h"

#include <stdbool.h>
#include <stdlib.h>

extern const tag_helper_handler_T content_tag_handler;
extern const tag_helper_handler_T tag_handler;
extern const tag_helper_handler_T link_to_handler;
extern const tag_helper_handler_T turbo_frame_tag_handler;
extern const tag_helper_handler_T javascript_tag_handler;
extern const tag_helper_handler_T javascript_include_tag_handler;
extern const tag_helper_handler_T image_tag_handler;
extern const tag_helper_handler_T stylesheet_link_tag_handler;

static const tag_helper_handler_T* const static_handlers[] = {
  &content_tag_handler,    &tag_handler,
  &link_to_handler,        &turbo_frame_tag_handler,
  &javascript_tag_handler, &javascript_include_tag_handler,
  &image_tag_handler,      &stylesheet_link_tag_handler,
};

static const size_t handlers_count = sizeof(static_handlers) / sizeof(static_handlers[0]);

tag_helper_info_T* tag_helper_info_init(hb_allocator_T* allocator) {
  tag_helper_info_T* info = hb_allocator_alloc(allocator, sizeof(tag_helper_info_T));

  if (info) {
    info->tag_name = NULL;
    info->call_node = NULL;
    info->attributes = NULL;
    info->content = NULL;
    info->has_block = false;
    info->allocator = allocator;
  }

  return info;
}

void tag_helper_info_free(tag_helper_info_T** info) {
  if (!info || !*info) { return; }

  hb_allocator_T* allocator = (*info)->allocator;

  if ((*info)->tag_name) { hb_allocator_dealloc(allocator, (*info)->tag_name); }
  if ((*info)->content) { hb_allocator_dealloc(allocator, (*info)->content); }
  if ((*info)->attributes) { hb_array_free(&(*info)->attributes); }

  hb_allocator_dealloc(allocator, *info);

  *info = NULL;
}

const tag_helper_handler_T* const* get_tag_helper_handlers(void) {
  return static_handlers;
}

size_t get_tag_helper_handlers_count(void) {
  return handlers_count;
}

char* extract_inline_block_content(pm_call_node_t* call_node, hb_allocator_T* allocator) {
  if (!call_node || !call_node->block || call_node->block->type != PM_BLOCK_NODE) { return NULL; }

  pm_block_node_t* block_node = (pm_block_node_t*) call_node->block;

  if (!block_node->body || block_node->body->type != PM_STATEMENTS_NODE) { return NULL; }

  pm_statements_node_t* statements = (pm_statements_node_t*) block_node->body;

  if (statements->body.size != 1) { return NULL; }

  pm_node_t* statement = statements->body.nodes[0];

  if (statement->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) statement;
    size_t length = pm_string_length(&string_node->unescaped);
    return hb_allocator_strndup(allocator, (const char*) pm_string_source(&string_node->unescaped), length);
  }

  size_t source_length = statement->location.end - statement->location.start;
  return hb_allocator_strndup(allocator, (const char*) statement->location.start, source_length);
}
