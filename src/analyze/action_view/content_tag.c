#include "../../include/analyze/action_view/tag_helper_handler.h"

#include <prism.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

bool detect_content_tag(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->name) { return false; }

  pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call_node->name);
  return constant && constant->length == 11 && strncmp((const char*) constant->start, "content_tag", 11) == 0;
}

char* extract_content_tag_name(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
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

  return NULL;
}

char* extract_content_tag_content(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  (void) parser;

  if (!call_node) { return NULL; }

  char* block_content = extract_inline_block_content(call_node, allocator);
  if (block_content) { return block_content; }

  if (call_node->arguments) {
    pm_arguments_node_t* arguments = call_node->arguments;

    if (arguments->arguments.size >= 2) {
      pm_node_t* second_argument = arguments->arguments.nodes[1];

      if (second_argument->type != PM_KEYWORD_HASH_NODE) {
        if (second_argument->type == PM_STRING_NODE) {
          pm_string_node_t* string_node = (pm_string_node_t*) second_argument;
          size_t length = pm_string_length(&string_node->unescaped);
          return hb_allocator_strndup(allocator, (const char*) pm_string_source(&string_node->unescaped), length);
        }

        size_t source_length = second_argument->location.end - second_argument->location.start;
        return hb_allocator_strndup(allocator, (const char*) second_argument->location.start, source_length);
      }
    }
  }

  return NULL;
}

bool content_tag_supports_block(void) {
  return true;
}

const tag_helper_handler_T content_tag_handler = { .name = "content_tag",
                                                   .source =
                                                     HB_STRING_LITERAL("ActionView::Helpers::TagHelper#content_tag"),
                                                   .detect = detect_content_tag,
                                                   .extract_tag_name = extract_content_tag_name,
                                                   .extract_content = extract_content_tag_content,
                                                   .supports_block = content_tag_supports_block };
