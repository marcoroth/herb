#include "../include/tag_helper_handler.h"
#include "../include/util.h"

#include <prism.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

bool detect_link_to(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->name) { return false; }

  pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call_node->name);

  return constant && constant->length == 7 && strncmp((const char*) constant->start, "link_to", 7) == 0;
}

char* extract_link_to_tag_name(pm_call_node_t* call_node, pm_parser_t* parser) {
  (void) call_node;
  (void) parser;

  return herb_strdup("a");
}

char* extract_link_to_content(pm_call_node_t* call_node, pm_parser_t* parser) {
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

char* extract_link_to_href(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->arguments) { return NULL; }

  pm_arguments_node_t* args = call_node->arguments;
  if (args->arguments.size < 2) { return NULL; }

  pm_node_t* second_arg = args->arguments.nodes[1];

  if (second_arg->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) second_arg;
    size_t length = pm_string_length(&string_node->unescaped);
    char* href = calloc(length + 1, sizeof(char));

    memcpy(href, pm_string_source(&string_node->unescaped), length);

    return href;
  } else {
    size_t source_length = second_arg->location.end - second_arg->location.start;

    char* ruby_expr = calloc(source_length + 1, sizeof(char));
    memcpy(ruby_expr, (const char*) second_arg->location.start, source_length);

    char* erb_wrapped = calloc(source_length + 10, sizeof(char));
    snprintf(erb_wrapped, source_length + 10, "<%%= %s %%>", ruby_expr);

    free(ruby_expr);

    return erb_wrapped;
  }
}

bool link_to_supports_block(void) {
  return true;
}

tag_helper_handler_T link_to_handler = { .name = "link_to",
                                         .source = "ActionView::Helpers::UrlHelper#link_to",
                                         .detect = detect_link_to,
                                         .extract_tag_name = extract_link_to_tag_name,
                                         .extract_content = extract_link_to_content,
                                         .supports_block = link_to_supports_block };
