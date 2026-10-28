#include "../../include/lib/hb_allocator.h"
#include "../../include/lib/hb_buffer.h"

#include <prism.h>
#include <stdbool.h>
#include <string.h>

static bool turbo_frame_tag_literal_id(pm_node_t* node, const char** source, size_t* length) {
  if (node->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) node;
    *source = (const char*) pm_string_source(&string_node->unescaped);
    *length = pm_string_length(&string_node->unescaped);

    return true;
  }

  if (node->type == PM_SYMBOL_NODE) {
    pm_symbol_node_t* symbol_node = (pm_symbol_node_t*) node;
    *source = (const char*) pm_string_source(&symbol_node->unescaped);
    *length = pm_string_length(&symbol_node->unescaped);

    return true;
  }

  return false;
}

// `turbo_frame_tag *ids` is `dom_id(*ids)` when the first id is a record or Class, `ids.join("_")` otherwise.
static char* extract_turbo_frame_tag_ids(
  pm_arguments_node_t* arguments,
  size_t count,
  pm_parser_t* parser,
  hb_allocator_T* allocator
) {
  (void) parser;

  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 128, allocator);

  bool all_literal = true;

  for (size_t index = 0; index < count; index++) {
    const char* literal = NULL;
    size_t literal_length = 0;

    if (!turbo_frame_tag_literal_id(arguments->arguments.nodes[index], &literal, &literal_length)) {
      all_literal = false;
      break;
    }

    if (index > 0) { hb_buffer_append(&buffer, "_"); }
    hb_buffer_append_with_length(&buffer, literal, literal_length);
  }

  if (!all_literal) {
    hb_buffer_clear(&buffer);
    hb_buffer_append(&buffer, "[");

    for (size_t index = 0; index < count; index++) {
      pm_node_t* node = arguments->arguments.nodes[index];

      if (index > 0) { hb_buffer_append(&buffer, ", "); }
      hb_buffer_append_with_length(&buffer, (const char*) node->location.start, node->location.end - node->location.start);
    }

    hb_buffer_append(&buffer, "].then { |ids| ids.first.respond_to?(:to_key) || ids.first.is_a?(Class)");
    hb_buffer_append(&buffer, " ? dom_id(*ids) : ids.join(\"_\") }");
  }

  char* result = hb_allocator_strdup(allocator, hb_buffer_value(&buffer));
  hb_buffer_free(&buffer);

  return result;
}

char* extract_turbo_frame_tag_id(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  if (!call_node || !call_node->arguments) { return NULL; }

  pm_arguments_node_t* arguments = call_node->arguments;
  if (!arguments->arguments.size) { return NULL; }

  size_t positional_count = 0;

  for (size_t index = 0; index < arguments->arguments.size; index++) {
    pm_node_type_t type = arguments->arguments.nodes[index]->type;

    if (type == PM_KEYWORD_HASH_NODE || type == PM_SPLAT_NODE) { break; }

    positional_count++;
  }

  if (positional_count == 0) { return NULL; }

  if (positional_count > 1) { return extract_turbo_frame_tag_ids(arguments, positional_count, parser, allocator); }

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

  hb_buffer_T buffer;
  hb_buffer_init(&buffer, source_length + 128, allocator);

  hb_buffer_append(&buffer, "(");
  hb_buffer_append_with_length(&buffer, source, source_length);
  hb_buffer_append(&buffer, ").then { |value| value.respond_to?(:to_key) || value.is_a?(Class)");
  hb_buffer_append(&buffer, " ? dom_id(value) : value.to_s }");

  char* result = hb_allocator_strdup(allocator, hb_buffer_value(&buffer));
  hb_buffer_free(&buffer);

  return result;
}

bool turbo_frame_tag_id_is_static(pm_call_node_t* call_node) {
  if (!call_node || !call_node->arguments) { return false; }

  pm_arguments_node_t* arguments = call_node->arguments;

  for (size_t index = 0; index < arguments->arguments.size; index++) {
    pm_node_t* node = arguments->arguments.nodes[index];

    if (node->type == PM_KEYWORD_HASH_NODE || node->type == PM_SPLAT_NODE) { break; }
    if (node->type != PM_STRING_NODE && node->type != PM_SYMBOL_NODE) { return false; }
  }

  return true;
}
