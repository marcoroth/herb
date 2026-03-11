#include "../../include/analyze/action_view/tag_helper_handler.h"

#include <prism.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

bool detect_turbo_frame_tag(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->name) { return false; }

  pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call_node->name);
  return constant && constant->length == 15 && strncmp((const char*) constant->start, "turbo_frame_tag", 15) == 0;
}

char* extract_turbo_frame_tag_name(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  (void) call_node;
  (void) parser;

  return hb_allocator_strdup(allocator, "turbo-frame");
}

char* extract_turbo_frame_tag_content(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  (void) call_node;
  (void) parser;
  (void) allocator;

  return NULL;
}

char* extract_turbo_frame_tag_id(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  (void) parser;

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
  return hb_allocator_strndup(allocator, (const char*) first_argument->location.start, source_length);
}

bool turbo_frame_tag_supports_block(void) {
  return true;
}

const tag_helper_handler_T turbo_frame_tag_handler = { .name = "turbo_frame_tag",
                                                       .source =
                                                         HB_STRING_LITERAL("Turbo::FramesHelper#turbo_frame_tag"),
                                                       .detect = detect_turbo_frame_tag,
                                                       .extract_tag_name = extract_turbo_frame_tag_name,
                                                       .extract_content = extract_turbo_frame_tag_content,
                                                       .supports_block = turbo_frame_tag_supports_block };
