#include "../../include/analyze/action_view/tag_helper_handler.h"

#include <prism.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

bool detect_javascript_tag(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->name) { return false; }

  pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call_node->name);
  return constant && constant->length == 14 && strncmp((const char*) constant->start, "javascript_tag", 14) == 0;
}

char* extract_javascript_tag_name(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  (void) call_node;
  (void) parser;

  return hb_allocator_strdup(allocator, "script");
}

char* extract_javascript_tag_content(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  (void) parser;

  if (!call_node || !call_node->arguments) { return NULL; }

  pm_arguments_node_t* arguments = call_node->arguments;
  if (!arguments->arguments.size) { return NULL; }

  pm_node_t* first_argument = arguments->arguments.nodes[0];

  if (first_argument->type == PM_KEYWORD_HASH_NODE) { return NULL; }

  if (first_argument->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) first_argument;
    size_t length = pm_string_length(&string_node->unescaped);
    return hb_allocator_strndup(allocator, (const char*) pm_string_source(&string_node->unescaped), length);
  }

  size_t source_length = first_argument->location.end - first_argument->location.start;
  return hb_allocator_strndup(allocator, (const char*) first_argument->location.start, source_length);
}

bool javascript_tag_supports_block(void) {
  return true;
}

const tag_helper_handler_T javascript_tag_handler = {
  .name = "javascript_tag",
  .source = HB_STRING_LITERAL("ActionView::Helpers::JavaScriptHelper#javascript_tag"),
  .detect = detect_javascript_tag,
  .extract_tag_name = extract_javascript_tag_name,
  .extract_content = extract_javascript_tag_content,
  .supports_block = javascript_tag_supports_block
};
