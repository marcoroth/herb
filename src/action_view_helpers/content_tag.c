#include "../include/tag_helper_handler.h"

#include <prism.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

bool detect_content_tag(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->name) { return false; }

  pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call_node->name);
  return constant && constant->length == 11 && strncmp((const char*) constant->start, "content_tag", 11) == 0;
}

char* extract_content_tag_name(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->arguments) { return NULL; }

  pm_arguments_node_t* args = call_node->arguments;
  if (!args->arguments.size) { return NULL; }

  pm_node_t* first_arg = args->arguments.nodes[0];

  if (first_arg->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) first_arg;

    size_t length = pm_string_length(&string_node->unescaped);
    char* tag_name = calloc(length + 1, sizeof(char));
    memcpy(tag_name, pm_string_source(&string_node->unescaped), length);

    return tag_name;
  } else if (first_arg->type == PM_SYMBOL_NODE) {
    pm_symbol_node_t* symbol_node = (pm_symbol_node_t*) first_arg;

    size_t length = pm_string_length(&symbol_node->unescaped);
    char* tag_name = calloc(length + 1, sizeof(char));
    memcpy(tag_name, pm_string_source(&symbol_node->unescaped), length);

    return tag_name;
  }

  return NULL;
}

char* extract_content_tag_content(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->arguments) { return NULL; }

  pm_arguments_node_t* args = call_node->arguments;
  if (args->arguments.size < 2) { return NULL; }

  pm_node_t* second_arg = args->arguments.nodes[1];

  if (second_arg->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) second_arg;
    size_t length = pm_string_length(&string_node->unescaped);
    char* content = calloc(length + 1, sizeof(char));
    memcpy(content, pm_string_source(&string_node->unescaped), length);
    return content;
  }

  return NULL;
}

bool content_tag_supports_block(void) {
  return true;
}

tag_helper_handler_T content_tag_handler = { .name = "content_tag",
                                             .source = "ActionView::Helpers::TagHelper#content_tag",
                                             .detect = detect_content_tag,
                                             .extract_tag_name = extract_content_tag_name,
                                             .extract_content = extract_content_tag_content,
                                             .supports_block = content_tag_supports_block };
