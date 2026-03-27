#include <prism.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

#include "../../include/analyze/action_view/tag_helper_handler.h"

bool detect_image_tag(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->name) { return false; }

  pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call_node->name);
  return constant && constant->length == 9 && strncmp((const char*) constant->start, "image_tag", 9) == 0;
}

char* extract_image_tag_name(pm_call_node_t* _call_node, pm_parser_t* _parser, hb_allocator_T* allocator) {
  return hb_allocator_strdup(allocator, "img");
}

char* extract_image_tag_content(pm_call_node_t* _call_node, pm_parser_t* _parser, hb_allocator_T* _allocator) {
  return NULL;
}

char* extract_image_tag_src(pm_call_node_t* call_node, pm_parser_t* _parser, hb_allocator_T* allocator) {
  if (!call_node || !call_node->arguments) { return NULL; }

  pm_arguments_node_t* arguments = call_node->arguments;
  if (!arguments->arguments.size) { return NULL; }

  pm_node_t* first_argument = arguments->arguments.nodes[0];

  if (first_argument->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) first_argument;
    size_t length = pm_string_length(&string_node->unescaped);

    return hb_allocator_strndup(allocator, (const char*) pm_string_source(&string_node->unescaped), length);
  }

  size_t source_length = first_argument->location.end - first_argument->location.start;
  return hb_allocator_strndup(allocator, (const char*) first_argument->location.start, source_length);
}

bool image_tag_source_is_url(const char* source, size_t length) {
  if (!source || length == 0) { return false; }

  if (length >= 2 && source[0] == '/' && source[1] == '/') { return true; }
  if (strstr(source, "://") != NULL) { return true; }

  return false;
}

char* wrap_in_image_path(const char* source, size_t source_length, hb_allocator_T* allocator) {
  const char* prefix = "image_path(";
  const char* suffix = ")";

  size_t prefix_length = strlen(prefix);
  size_t suffix_length = strlen(suffix);
  size_t total_length = prefix_length + source_length + suffix_length;
  char* result = hb_allocator_alloc(allocator, total_length + 1);

  memcpy(result, prefix, prefix_length);
  memcpy(result + prefix_length, source, source_length);
  memcpy(result + prefix_length + source_length, suffix, suffix_length);

  result[total_length] = '\0';

  return result;
}

bool image_tag_supports_block(void) {
  return false;
}

const tag_helper_handler_T image_tag_handler = { .name = "image_tag",
                                                 .source =
                                                   HB_STRING_LITERAL("ActionView::Helpers::AssetTagHelper#image_tag"),
                                                 .detect = detect_image_tag,
                                                 .extract_tag_name = extract_image_tag_name,
                                                 .extract_content = extract_image_tag_content,
                                                 .supports_block = image_tag_supports_block };
