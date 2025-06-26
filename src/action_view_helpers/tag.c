#include "../include/tag_helper_handler.h"

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

char* extract_tag_dot_name(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->name) { return NULL; }

  pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call_node->name);
  if (!constant) { return NULL; }

  char* tag_name = calloc(constant->length + 1, sizeof(char));
  memcpy(tag_name, constant->start, constant->length);

  return tag_name;
}

// TODO: this should probably be an array of nodes
char* extract_tag_dot_content(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->arguments) { return NULL; }

  pm_arguments_node_t* args = call_node->arguments;
  if (!args->arguments.size) { return NULL; }

  pm_node_t* first_arg = args->arguments.nodes[0];

  if (first_arg->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) first_arg;
    size_t length = pm_string_length(&string_node->unescaped);
    char* content = calloc(length + 1, sizeof(char));
    memcpy(content, pm_string_source(&string_node->unescaped), length);
    return content;
  }

  return NULL;
}

bool tag_dot_supports_block(void) {
  return true;
}

tag_helper_handler_T tag_dot_handler = { .name = "tag",
                                         .source = "ActionView::Helpers::TagHelper#tag",
                                         .detect = detect_tag_dot,
                                         .extract_tag_name = extract_tag_dot_name,
                                         .extract_content = extract_tag_dot_content,
                                         .supports_block = tag_dot_supports_block };
