#include "../../include/analyze/action_view/tag_helper_handler.h"
#include "../../include/analyze/action_view/tag_helper_node_builders.h"
#include "../../include/ast/ast_nodes.h"
#include "../../include/lib/hb_array.h"
#include "../../include/lib/hb_string.h"
#include "../../include/visitor.h"

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

bool wrap_javascript_tag_body_visitor(const AST_NODE_T* node, void* data) {
  hb_allocator_T* allocator = (hb_allocator_T*) data;

  if (node == NULL || node->type != AST_HTML_ELEMENT_NODE) { return true; }

  AST_HTML_ELEMENT_NODE_T* element = (AST_HTML_ELEMENT_NODE_T*) node;

  if (!hb_string_equals(element->element_source, hb_string("ActionView::Helpers::JavaScriptHelper#javascript_tag"))) {
    return true;
  }

  if (element->body == NULL || hb_array_size(element->body) == 0) { return false; }

  for (size_t i = 0; i < hb_array_size(element->body); i++) {
    AST_NODE_T* child = (AST_NODE_T*) hb_array_get(element->body, i);
    if (child && child->type == AST_CDATA_NODE) { return false; }
  }

  hb_array_T* cdata_children = hb_array_init(hb_array_size(element->body), allocator);

  for (size_t i = 0; i < hb_array_size(element->body); i++) {
    hb_array_append(cdata_children, hb_array_get(element->body, i));
  }

  token_T* cdata_opening = create_synthetic_token(
    allocator,
    "\n//<![CDATA[\n",
    TOKEN_CDATA_START,
    element->base.location.start,
    element->base.location.end
  );

  token_T* cdata_closing = create_synthetic_token(
    allocator,
    "\n//]]>\n",
    TOKEN_CDATA_END,
    element->base.location.start,
    element->base.location.end
  );

  AST_CDATA_NODE_T* cdata_node = ast_cdata_node_init(
    cdata_opening,
    cdata_children,
    cdata_closing,
    element->base.location.start,
    element->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  element->body->size = 0;
  hb_array_append(element->body, (AST_NODE_T*) cdata_node);

  return false;
}

const tag_helper_handler_T javascript_tag_handler = {
  .name = "javascript_tag",
  .source = HB_STRING_LITERAL("ActionView::Helpers::JavaScriptHelper#javascript_tag"),
  .detect = detect_javascript_tag,
  .extract_tag_name = extract_javascript_tag_name,
  .extract_content = extract_javascript_tag_content,
  .supports_block = javascript_tag_supports_block
};
