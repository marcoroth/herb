#include "../../include/analyze/action_view/tag_helper_handler.h"

#include <prism.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

bool detect_javascript_include_tag(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->name) { return false; }

  pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call_node->name);
  return constant && constant->length == 22
      && strncmp((const char*) constant->start, "javascript_include_tag", 22) == 0;
}

char* extract_javascript_include_tag_name(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  (void) call_node;
  (void) parser;

  return hb_allocator_strdup(allocator, "script");
}

char* extract_javascript_include_tag_content(
  pm_call_node_t* call_node,
  pm_parser_t* parser,
  hb_allocator_T* allocator
) {
  (void) call_node;
  (void) parser;
  (void) allocator;

  return NULL;
}

char* extract_javascript_include_tag_src(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  (void) parser;

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

bool javascript_include_tag_source_is_url(const char* source, size_t length) {
  if (!source || length == 0) { return false; }

  if (length >= 2 && source[0] == '/' && source[1] == '/') { return true; }
  if (strstr(source, "://") != NULL) { return true; }

  return false;
}

char* wrap_in_javascript_path(const char* source, size_t source_length, hb_allocator_T* allocator) {
  const char* prefix = "javascript_path(";
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

bool javascript_include_tag_supports_block(void) {
  return false;
}

const tag_helper_handler_T javascript_include_tag_handler = {
  .name = "javascript_include_tag",
  .source = HB_STRING_LITERAL("ActionView::Helpers::AssetTagHelper#javascript_include_tag"),
  .detect = detect_javascript_include_tag,
  .extract_tag_name = extract_javascript_include_tag_name,
  .extract_content = extract_javascript_include_tag_content,
  .supports_block = javascript_include_tag_supports_block
};
