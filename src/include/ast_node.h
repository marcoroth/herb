#ifndef ERBX_AST_H
#define ERBX_AST_H

#include "array.h"
#include "buffer.h"

typedef enum {
  AST_LITERAL_NODE,
  AST_STRING_COMPOUND_NODE,
  AST_UNEXCPECTED_TOKEN_NODE,

  // AST_HTML_ROOT_NODE,
  AST_HTML_DOCUMENT_NODE, // maybe document makes more sense instead of root?

  AST_HTML_DOCTYPE_NODE,
  AST_HTML_COMMENT_NODE,
  AST_HTML_ELEMENT_NODE,
  AST_HTML_TEXT_NODE,

  AST_HTML_OPEN_TAG_NODE,
  AST_HTML_CLOSE_TAG_NODE,
  AST_HTML_SELF_CLOSE_TAG_NODE,

  AST_HTML_ELEMENT_BODY_NODE,

  // AST_HTML_PROPERTY_NODE,
  // AST_HTML_PROPERTY_NAME,
  // AST_HTML_PROPERTY_VALUE,

  AST_HTML_ATTRIBUTE_SET_NODE, // maybe rename to attribute_list
  AST_HTML_ATTRIBUTE_NODE,
  AST_HTML_ATTRIBUTE_CONDITIONAL_NODE,
  AST_HTML_ATTRIBUTE_NAME_NODE,
  AST_HTML_ATTRIBUTE_VALUE_NODE,
  AST_HTML_ATTRIBUTE_SPREAD_NODE,

  AST_HTML_WHITESPACE_NODE,

  AST_ERB_LOUD_NODE,   // or: AST_ERB_EXPRESSION_NODE
  AST_ERB_SILENT_NODE, // or: AST_ERB_STATEMENT_NODE
  AST_ERB_RAW_NODE,
  AST_ERB_BLOCK_NODE,
  AST_ERB_COMMENT_NODE,

  AST_ERB_CONDITIONAL_NODE,
  AST_ERB_ITERATION_NODE,
  AST_ERB_FLOW_CONTROL_NODE,
  AST_ERB_BEGIN_RESCUE_NODE,

  AST_ERB_RENDER_CALL_NODE, // maybe this can just be a regular AST_ERB_EXPRESSION_NODE
  AST_ERB_YIELD_NODE,       // maybe this can just be a regular AST_ERB_EXPRESSION_NODE
  AST_ERB_CONTENT_NODE,     // maybe this can just be a regular AST_ERB_EXPRESSION_NODE

  AST_RUBY_STATEMENTS_NODE,

  AST_NOOP_NODE, // temporary node
} ast_node_type_T;

typedef struct AST_NODE_STRUCT {
  ast_node_type_T type;
  array_T* children;
  char* name;
  struct AST_STRUCT* value;
  int data_type;
  int int_value;
} AST_NODE_T;

AST_NODE_T* ast_node_init(ast_node_type_T type);

size_t ast_node_sizeof(void);

ast_node_type_T ast_node_type(AST_NODE_T* node);
size_t ast_node_child_count(AST_NODE_T* node);

char* ast_node_type_to_string(AST_NODE_T* node);
char* ast_node_name(AST_NODE_T* node);

void ast_node_pretty_print(AST_NODE_T* node, size_t indent, buffer_T* buffer);

#endif
