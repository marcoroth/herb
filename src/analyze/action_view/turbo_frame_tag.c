#include "../../include/lib/hb_allocator.h"

#include <prism.h>
#include <stdbool.h>
#include <string.h>

char* extract_turbo_frame_tag_id(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  if (!call_node || !call_node->arguments) { return NULL; }

  pm_arguments_node_t* arguments = call_node->arguments;
  if (!arguments->arguments.size) { return NULL; }

  pm_node_t* first_argument = arguments->arguments.nodes[0];

  if (first_argument->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) first_argument;
    size_t length = pm_string_length(&string_node->unescaped);

    return hb_allocator_strndup(allocator, (const char*) pm_string_source(&string_node->unescaped), length);
  } else if (first_argument->type == PM_SYMBOL_NODE) {
    pm_symbol_node_t* symbol_node = (pm_symbol_node_t*) first_argument;
    size_t length = pm_string_length(&symbol_node->unescaped);

    return hb_allocator_strndup(allocator, (const char*) pm_string_source(&symbol_node->unescaped), length);
  }

  size_t source_length = first_argument->location.end - first_argument->location.start;
  const char* source = (const char*) first_argument->location.start;

  if (first_argument->type == PM_CALL_NODE) {
    pm_call_node_t* call = (pm_call_node_t*) first_argument;
    pm_constant_t* call_constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call->name);

    if (call_constant && call_constant->length == 6 && strncmp((const char*) call_constant->start, "dom_id", 6) == 0) {
      return hb_allocator_strndup(allocator, source, source_length);
    }
  }

  const char* prefix = "dom_id(";
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
