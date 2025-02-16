#include "include/ast_node.h"
#include "include/buffer.h"

#include <stdio.h>
#include <stdlib.h>

size_t ast_node_sizeof(void) {
  return sizeof(struct AST_NODE_STRUCT);
}

AST_NODE_T* ast_node_init(ast_node_type_T type) {
  AST_NODE_T* node = calloc(1, ast_node_sizeof());

  node->type = type;
  node->children = array_init(ast_node_sizeof());

  return node;
}

char* ast_node_name(AST_NODE_T* node) {
  return node->name;
}

ast_node_type_T ast_node_type(AST_NODE_T* node) {
  return node->type;
}

size_t ast_node_child_count(AST_NODE_T* node) {
  return array_size(node->children);
}

array_T* ast_node_children(AST_NODE_T* node) {
  return node->children;
}

char* ast_node_type_to_string(AST_NODE_T* node) {
  switch (node->type) {
    case AST_LITERAL_NODE: return "AST_LITERAL_NODE";
    case AST_STRING_COMPOUND_NODE: return "AST_STRING_COMPOUND_NODE";

    case AST_HTML_DOCUMENT_NODE: return "AST_HTML_DOCUMENT_NODE";
    case AST_HTML_DOCTYPE_NODE: return "AST_HTML_DOCTYPE_NODE";
    case AST_HTML_COMMENT_NODE: return "AST_HTML_COMMENT_NODE";
    case AST_HTML_ELEMENT_NODE: return "AST_HTML_ELEMENT_NODE";
    case AST_HTML_TEXT_NODE: return "AST_HTML_TEXT_NODE";

    case AST_HTML_OPEN_TAG_NODE: return "AST_HTML_OPEN_TAG_NODE";
    case AST_HTML_CLOSE_TAG_NODE: return "AST_HTML_CLOSE_TAG_NODE";

    case AST_HTML_ATTRIBUTE_SET_NODE: return "AST_HTML_ATTRIBUTE_SET_NODE";
    case AST_HTML_ATTRIBUTE_NODE: return "AST_HTML_ATTRIBUTE_NODE";
    case AST_HTML_ATTRIBUTE_CONDITIONAL_NODE: return "AST_HTML_ATTRIBUTE_CONDITIONAL_NODE";
    case AST_HTML_ATTRIBUTE_NAME_NODE: return "AST_HTML_ATTRIBUTE_NAME_NODE";
    case AST_HTML_ATTRIBUTE_VALUE_NODE: return "AST_HTML_ATTRIBUTE_VALUE_NODE";
    case AST_HTML_ATTRIBUTE_SPREAD_NODE: return "AST_HTML_ATTRIBUTE_SPREAD_NODE";

    case AST_HTML_WHITESPACE_NODE: return "AST_HTML_WHITESPACE_NODE";

    case AST_ERB_LOUD_NODE: return "AST_ERB_LOUD_NODE";
    case AST_ERB_SILENT_NODE: return "AST_ERB_SILENT_NODE";
    case AST_ERB_RAW_NODE: return "AST_ERB_RAW_NODE";
    case AST_ERB_BLOCK_NODE: return "AST_ERB_BLOCK_NODE";
    case AST_ERB_COMMENT_NODE: return "AST_ERB_COMMENT_NODE";

    case AST_ERB_CONDITIONAL_NODE: return "AST_ERB_CONDITIONAL_NODE";
    case AST_ERB_ITERATION_NODE: return "AST_ERB_ITERATION_NODE";
    case AST_ERB_FLOW_CONTROL_NODE: return "AST_ERB_FLOW_CONTROL_NODE";
    case AST_ERB_BEGIN_RESCUE_NODE: return "AST_ERB_BEGIN_RESCUE_NODE";

    case AST_ERB_RENDER_CALL_NODE: return "AST_ERB_RENDER_CALL_NODE";
    case AST_ERB_YIELD_NODE: return "AST_ERB_YIELD_NODE";
    case AST_ERB_CONTENT_NODE: return "AST_ERB_CONTENT_NODE";

    case AST_RUBY_STATEMENTS_NODE: return "AST_RUBY_STATEMENTS_NODE";

    case AST_NOOP_NODE: return "AST_NOOP_NODE";
  }
}

char* ast_node_human_type(AST_NODE_T* node) {
  switch (node->type) {
    case AST_LITERAL_NODE: return "Literal";
    case AST_STRING_COMPOUND_NODE: return "StringCompound";

    case AST_HTML_DOCUMENT_NODE: return "DocumentNode";
    case AST_HTML_DOCTYPE_NODE: return "Doctype";
    case AST_HTML_COMMENT_NODE: return "Comment";
    case AST_HTML_ELEMENT_NODE: return "Element";
    case AST_HTML_TEXT_NODE: return "TextContent";

    case AST_HTML_OPEN_TAG_NODE: return "OpenTag";
    case AST_HTML_CLOSE_TAG_NODE: return "CloseTag";

    case AST_HTML_ATTRIBUTE_SET_NODE: return "AttributeSet";
    case AST_HTML_ATTRIBUTE_NODE: return "Attribute";
    case AST_HTML_ATTRIBUTE_CONDITIONAL_NODE: return "CondiationalAttribute";
    case AST_HTML_ATTRIBUTE_NAME_NODE: return "AttributeName";
    case AST_HTML_ATTRIBUTE_VALUE_NODE: return "AttributeValue";
    case AST_HTML_ATTRIBUTE_SPREAD_NODE: return "AttributeSpread";

    case AST_HTML_WHITESPACE_NODE: return "Whitespace";

    case AST_ERB_LOUD_NODE: return "ERBOutput";
    case AST_ERB_SILENT_NODE: return "ERBExpression";
    case AST_ERB_RAW_NODE: return "ERBRaw";
    case AST_ERB_BLOCK_NODE: return "ERBBlock";
    case AST_ERB_COMMENT_NODE: return "ERBComment";

    case AST_ERB_CONDITIONAL_NODE: return "ERBConditional";
    case AST_ERB_ITERATION_NODE: return "ERBIteration";
    case AST_ERB_FLOW_CONTROL_NODE: return "ERBFlowControl";
    case AST_ERB_BEGIN_RESCUE_NODE: return "ERBBeginRescue";

    case AST_ERB_RENDER_CALL_NODE: return "ERBRenderCall";
    case AST_ERB_YIELD_NODE: return "ERBYield";
    case AST_ERB_CONTENT_NODE: return "ERBContent";

    case AST_RUBY_STATEMENTS_NODE: return "RubyStatements";

    case AST_NOOP_NODE: return "Noop";
  }
}

void ast_node_pretty_print(AST_NODE_T* node, size_t indent, buffer_T* buffer) {
  buffer_append_whitespace(buffer, indent * 2);

  buffer_append(buffer, "@ ");
  buffer_append(buffer, ast_node_human_type(node));
  buffer_append(buffer, " (location: (0,0)-(0,0))\n");

  buffer_append_whitespace(buffer, indent * 2);
  buffer_append(buffer, "├── ");

  if (node->name != NULL) {
    buffer_append(buffer, "name: ");
    buffer_append(buffer, node->name);
    buffer_append(buffer, "\n");
  } else {
    buffer_append(buffer, "name: ∅\n");
  }

  buffer_append_whitespace(buffer, indent * 2);
  buffer_append(buffer, "└── ");

  if (array_size(node->children) == 0) {
    buffer_append(buffer, "children: []\n\n");
  } else {
    buffer_append(buffer, "children: (");

    char count[16];
    sprintf(count, "%zu", array_size(node->children));
    buffer_append(buffer, count);

    buffer_append(buffer, ")\n");
  }

  if (indent < 20) {
    for (size_t i = 0; i < array_size(node->children); i++) {
      AST_NODE_T* child = array_get(node->children, i);
      ast_node_pretty_print(child, indent + 1 * 2, buffer);
    }
  }
}
