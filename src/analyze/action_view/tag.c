#include "../../include/analyze/action_view/tag_helper_handler.h"
#include "../../include/util/ruby_util.h"

#include <prism.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

bool detect_tag_dot(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->receiver) { return false; }
  if (call_node->receiver->type != PM_CALL_NODE) { return false; }

  pm_call_node_t* receiver_node = (pm_call_node_t*) call_node->receiver;
  if (!receiver_node->name) { return false; }

  pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, receiver_node->name);

  return constant && constant->length == 3 && strncmp((const char*) constant->start, "tag", 3) == 0;
}

char* extract_tag_dot_name(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  if (!call_node || !call_node->name) { return NULL; }

  pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call_node->name);
  if (!constant) { return NULL; }

  if (is_ruby_introspection_method(hb_string_from_data((const char*) constant->start, constant->length))) {
    return NULL;
  }

  char* name = hb_allocator_strndup(allocator, (const char*) constant->start, constant->length);

  for (size_t i = 0; i < constant->length && name[i] != '\0'; i++) {
    if (name[i] == '_') { name[i] = '-'; }
  }

  return name;
}

// TODO: this should probably be an array of nodes
char* extract_tag_dot_content(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  if (!call_node) { return NULL; }

  if (call_node->name) {
    pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call_node->name);

    if (constant
        && is_ruby_introspection_method(hb_string_from_data((const char*) constant->start, constant->length))) {
      return NULL;
    }
  }

  char* block_content = extract_inline_block_content(call_node, allocator);
  if (block_content) { return block_content; }

  if (call_node->arguments) {
    pm_arguments_node_t* arguments = call_node->arguments;

    if (arguments->arguments.size) {
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
  }

  return NULL;
}

bool tag_dot_supports_block(void) {
  return true;
}

const tag_helper_handler_T tag_dot_handler = { .name = "tag",
                                               .source = HB_STRING_LITERAL("ActionView::Helpers::TagHelper#tag"),
                                               .detect = detect_tag_dot,
                                               .extract_tag_name = extract_tag_dot_name,
                                               .extract_content = extract_tag_dot_content,
                                               .supports_block = tag_dot_supports_block };
