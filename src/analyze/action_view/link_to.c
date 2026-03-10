#include "../../include/analyze/action_view/tag_helper_handler.h"

#include <prism.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

char* wrap_in_url_for(const char* source, size_t source_length, hb_allocator_T* allocator) {
  const char* prefix = "url_for(";
  const char* suffix = ")";
  size_t prefix_len = strlen(prefix);
  size_t suffix_len = strlen(suffix);
  size_t total_length = prefix_len + source_length + suffix_len;
  char* result = hb_allocator_alloc(allocator, total_length + 1);

  memcpy(result, prefix, prefix_len);
  memcpy(result + prefix_len, source, source_length);
  memcpy(result + prefix_len + source_length, suffix, suffix_len);
  result[total_length] = '\0';

  return result;
}

bool detect_link_to(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->name) { return false; }

  pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call_node->name);

  return constant && constant->length == 7 && strncmp((const char*) constant->start, "link_to", 7) == 0;
}

bool is_route_helper_node(pm_node_t* node, pm_parser_t* parser) {
  if (!node || node->type != PM_CALL_NODE) { return false; }

  pm_call_node_t* call = (pm_call_node_t*) node;
  if (!call->name) { return false; }

  pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call->name);
  if (!constant || constant->length < 5) { return false; }

  const char* name = (const char*) constant->start;
  size_t length = constant->length;

  return (length >= 5 && strncmp(name + length - 5, "_path", 5) == 0)
      || (length >= 4 && strncmp(name + length - 4, "_url", 4) == 0);
}

char* extract_link_to_tag_name(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  (void) call_node;
  (void) parser;

  return hb_allocator_strdup(allocator, "a");
}

char* extract_link_to_content(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  (void) parser;

  if (!call_node || !call_node->arguments) { return NULL; }

  pm_arguments_node_t* arguments = call_node->arguments;
  if (!arguments->arguments.size) { return NULL; }

  pm_node_t* first_argument = arguments->arguments.nodes[0];

  if (first_argument->type == PM_NIL_NODE) { return NULL; }

  if (first_argument->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) first_argument;
    size_t length = pm_string_length(&string_node->unescaped);
    return hb_allocator_strndup(allocator, (const char*) pm_string_source(&string_node->unescaped), length);
  }

  size_t source_length = first_argument->location.end - first_argument->location.start;

  // Format: "<expression>.to_s"
  if (arguments->arguments.size == 1) {
    const char* suffix = ".to_s";
    size_t suffix_len = strlen(suffix);
    size_t total_length = source_length + suffix_len;
    char* ruby_expression = hb_allocator_alloc(allocator, total_length + 1);

    memcpy(ruby_expression, (const char*) first_argument->location.start, source_length);
    memcpy(ruby_expression + source_length, suffix, suffix_len);
    ruby_expression[total_length] = '\0';

    return ruby_expression;
  }

  return hb_allocator_strndup(allocator, (const char*) first_argument->location.start, source_length);
}

char* extract_link_to_href(pm_call_node_t* call_node, pm_parser_t* parser, hb_allocator_T* allocator) {
  (void) parser;

  if (!call_node || !call_node->arguments) { return NULL; }

  pm_arguments_node_t* arguments = call_node->arguments;

  // Format: "url_for(<expression>)"
  if (arguments->arguments.size == 1) {
    pm_node_t* first_argument = arguments->arguments.nodes[0];

    if (first_argument->type == PM_STRING_NODE || first_argument->type == PM_NIL_NODE) { return NULL; }

    size_t source_length = first_argument->location.end - first_argument->location.start;

    if (is_route_helper_node(first_argument, parser)) {
      return hb_allocator_strndup(allocator, (const char*) first_argument->location.start, source_length);
    }

    return wrap_in_url_for((const char*) first_argument->location.start, source_length, allocator);
  }

  if (arguments->arguments.size < 2) { return NULL; }

  pm_node_t* second_argument = arguments->arguments.nodes[1];

  if (second_argument->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) second_argument;
    size_t length = pm_string_length(&string_node->unescaped);
    return hb_allocator_strndup(allocator, (const char*) pm_string_source(&string_node->unescaped), length);
  }

  size_t source_length = second_argument->location.end - second_argument->location.start;

  if (!is_route_helper_node(second_argument, parser)) {
    return wrap_in_url_for((const char*) second_argument->location.start, source_length, allocator);
  }

  return hb_allocator_strndup(allocator, (const char*) second_argument->location.start, source_length);
}

bool link_to_supports_block(void) {
  return true;
}

const tag_helper_handler_T link_to_handler = { .name = "link_to",
                                               .source = HB_STRING_LITERAL("ActionView::Helpers::UrlHelper#link_to"),
                                               .detect = detect_link_to,
                                               .extract_tag_name = extract_link_to_tag_name,
                                               .extract_content = extract_link_to_content,
                                               .supports_block = link_to_supports_block };
