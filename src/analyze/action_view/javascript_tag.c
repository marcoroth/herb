#include "../../include/analyze/action_view/tag_helper_node_builders.h"
#include "../../include/ast/ast_nodes.h"
#include "../../include/lib/hb_array.h"
#include "../../include/lib/hb_string.h"
#include "../../include/visitor.h"

#include <stdbool.h>
#include <stdlib.h>

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

  AST_CDATA_NODE_T* cdata_node =
    create_javascript_cdata_node(cdata_children, element->base.location.start, element->base.location.end, allocator);

  element->body->size = 0;
  hb_array_append(element->body, (AST_NODE_T*) cdata_node);

  return false;
}
