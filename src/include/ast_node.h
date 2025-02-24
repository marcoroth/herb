#ifndef ERBX_AST_H
#define ERBX_AST_H

#include "array.h"
#include "buffer.h"
#include "location.h"
#include "token_struct.h"

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
  location_T* start;
  location_T* end;
  // maybe a range too?
} AST_NODE_T;

typedef struct {
  AST_NODE_T base;
  const char* content;
} AST_LITERAL_T;

typedef struct {
  AST_NODE_T base;
  array_T* attributes;
} AST_HTML_ATTRIBUTE_SET_NODE_T;

typedef struct {
  AST_NODE_T base;
  token_T* tag_opening;
  token_T* tag_name;
  array_T* attributes;
  token_T* tag_closing;
  bool is_void;
} AST_HTML_OPEN_TAG_NODE_T;

typedef struct {
  AST_NODE_T base;
  token_T* tag_opening;
  token_T* tag_name;
  token_T* tag_closing;
} AST_HTML_CLOSE_TAG_NODE_T;

// typedef struct {
//   AST_NODE_T base;
//   AST_HTML_ATTRIBUTE_SET_NODE_T* attributes;
//   token_T* tag_opening;
//   token_T* tag_closing;
// } AST_HTML_SELF_CLOSE_TAG_NODE_T;

typedef struct {
  AST_NODE_T base;
} AST_HTML_ELEMENT_BODY_NODE_T;

typedef struct {
  AST_NODE_T base;
  bool is_void;
  token_T* tag_name;
  AST_HTML_OPEN_TAG_NODE_T* open_tag;
  AST_HTML_ELEMENT_BODY_NODE_T* body;
  AST_HTML_CLOSE_TAG_NODE_T* close_tag;
} AST_HTML_ELEMENT_NODE_T;

typedef struct {
  AST_NODE_T base;
  token_T* open_quote;
  token_T* close_quote;
  bool quoted;
} AST_HTML_ATTRIBUTE_VALUE_NODE_T;

typedef struct {
  AST_NODE_T base;
  token_T* name;
} AST_HTML_ATTRIBUTE_NAME_NODE_T;

typedef struct {
  AST_NODE_T base;
  AST_HTML_ATTRIBUTE_NAME_NODE_T* name;
  token_T* equals;
  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value;
} AST_HTML_ATTRIBUTE_NODE_T;

typedef struct {
  AST_NODE_T base;
  const char* content;
} AST_HTML_TEXT_NODE_T;

typedef struct {
  AST_NODE_T base;
  token_T* comment_start;
  token_T* comment_end;
} AST_HTML_COMMENT_T;

typedef struct {
  AST_NODE_T base;
  token_T* tag_opening;
  const char* content;
  token_T* tag_closing;
} AST_HTML_DOCTYPE_NODE_T;

typedef struct {
  AST_NODE_T base;
} AST_HTML_WHITESPACE_T;

typedef struct {
  AST_NODE_T base;
  token_T* tag_opening;
  token_T* content;
  token_T* tag_closing;
} AST_ERB_CONTENT_NODE_T;

typedef struct {
  AST_NODE_T base;
} AST_HTML_DOCUMENT_NODE_T;

typedef struct {
  AST_NODE_T base;
  const char* message;
  const char* expected;
  const char* got;
} AST_UNEXPECTED_TOKEN_NODE_T;

void ast_node_init(AST_NODE_T* node, ast_node_type_T type);

AST_LITERAL_T* ast_literal_node_init(const char* content);
AST_HTML_ELEMENT_NODE_T* ast_html_element_node_init(
  token_T* tag_name, bool is_void, AST_HTML_OPEN_TAG_NODE_T* open_tag, AST_HTML_ELEMENT_BODY_NODE_T* body,
  AST_HTML_CLOSE_TAG_NODE_T* close_tag
);
AST_HTML_OPEN_TAG_NODE_T* ast_html_open_tag_node_init(
  token_T* tag_name, array_T* attributes, array_T* children, token_T* tag_opening, token_T* tag_closing
);
// AST_HTML_SELF_CLOSE_TAG_NODE_T* ast_html_self_close_tag_node_init(AST_HTML_ATTRIBUTE_SET_NODE_T attributes, token_T*
// tag_opening, token_T* tag_closing);
AST_HTML_CLOSE_TAG_NODE_T* ast_html_close_tag_node_init(token_T* tag_opening, token_T* tag_name, token_T* tag_closing);
AST_HTML_ELEMENT_BODY_NODE_T* ast_html_element_body_node_init(void);
AST_HTML_COMMENT_T* ast_html_comment_node_init(token_T* comment_start, array_T* children, token_T* comment_end);
AST_ERB_CONTENT_NODE_T* ast_erb_content_node_init(token_T* tag_opening, token_T* content, token_T* tag_closing);
AST_HTML_TEXT_NODE_T* ast_html_text_node_init(const char* content);
AST_HTML_DOCTYPE_NODE_T* ast_html_doctype_node_init(token_T* tag_opening, array_T* children, token_T* tag_closing);
AST_HTML_DOCUMENT_NODE_T* ast_html_document_node_init(void);
AST_HTML_ATTRIBUTE_SET_NODE_T* ast_html_attribute_set_node_init(void);
AST_HTML_ATTRIBUTE_NODE_T* ast_html_attribute_node_init(
  AST_HTML_ATTRIBUTE_NAME_NODE_T* name, token_T* equals, AST_HTML_ATTRIBUTE_VALUE_NODE_T* value
);
AST_HTML_ATTRIBUTE_NAME_NODE_T* ast_html_attribute_name_node_init(token_T* name);
AST_HTML_ATTRIBUTE_VALUE_NODE_T* ast_html_attribute_value_node_init(
  token_T* open_quote, array_T* children, token_T* close_quote
);
AST_UNEXPECTED_TOKEN_NODE_T* ast_unexpected_node_init(const char* message, const char* expected, const char* got);

size_t ast_node_sizeof(void);

ast_node_type_T ast_node_type(AST_NODE_T* node);
size_t ast_node_child_count(AST_NODE_T* node);

char* ast_node_type_to_string(AST_NODE_T* node);
char* ast_node_name(AST_NODE_T* node);

void ast_node_set_start(AST_NODE_T* node, location_T* location);
void ast_node_set_end(AST_NODE_T* node, location_T* location);

void ast_node_set_start_from_token(AST_NODE_T* node, token_T* token);
void ast_node_set_end_from_token(AST_NODE_T* node, token_T* token);

void ast_node_set_locations_from_token(AST_NODE_T* node, token_T* token);

void ast_node_pretty_print(AST_NODE_T* node, size_t indent, size_t relative_indent, buffer_T* buffer);

#endif
