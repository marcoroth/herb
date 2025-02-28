#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/buffer.h"
#include "include/token.h"
#include "include/token_struct.h"
#include "include/util.h"

#include <stdio.h>
#include <stdlib.h>

size_t ast_node_sizeof(void) {
  return sizeof(struct AST_NODE_STRUCT);
}

void ast_node_init(AST_NODE_T* node, ast_node_type_T type) {
  if (!node) { return; }

  node->type = type;
  node->start = location_init(0, 0);
  node->end = location_init(0, 0);
  node->errors = array_init(1);
}

AST_LITERAL_NODE_T* ast_literal_node_init_from_token(token_T* token) {
  AST_LITERAL_NODE_T* literal = malloc(sizeof(AST_LITERAL_NODE_T));

  ast_node_init(&literal->base, AST_LITERAL_NODE);

  literal->content = erbx_strdup(token->value);

  ast_node_set_locations_from_token(&literal->base, token);

  return literal;
}

// AST_HTML_ELEMENT_NODE_T* ast_html_element_node_init(
//   token_T* tag_name, bool is_void, AST_HTML_OPEN_TAG_NODE_T* open_tag, AST_HTML_ELEMENT_BODY_NODE_T* body,
//   AST_HTML_CLOSE_TAG_NODE_T* close_tag
// ) {
//   AST_HTML_ELEMENT_NODE_T* element = malloc(sizeof(AST_HTML_ELEMENT_NODE_T));
//
//   ast_node_init(&element->base, AST_HTML_ELEMENT_NODE);
//
//   element->tag_name = tag_name;
//   element->is_void = is_void;
//   element->open_tag = open_tag;
//   element->body = body;
//   element->close_tag = close_tag;
//
//   if (body != NULL && body->base.children != NULL) { element->base.children = body->base.children; }
//
//   ast_node_set_start(&element->base, open_tag->base.start);
//
//   if (close_tag != NULL) {
//     ast_node_set_end(&element->base, close_tag->base.end);
//   } else {
//     ast_node_set_end(&element->base, open_tag->base.end);
//   }
//
//   return element;
// }
//
// AST_HTML_ELEMENT_BODY_NODE_T* ast_html_element_body_node_init(void) {
//   AST_HTML_ELEMENT_BODY_NODE_T* element = malloc(sizeof(AST_HTML_ELEMENT_BODY_NODE_T));
//
//   ast_node_init(&element->base, AST_HTML_ELEMENT_BODY_NODE);
//
//   element->base.type = AST_HTML_ELEMENT_BODY_NODE;
//
//   return element;
// }
//
// AST_HTML_OPEN_TAG_NODE_T* ast_html_open_tag_node_init(
//   token_T* tag_name, array_T* attributes, array_T* children, token_T* tag_opening, token_T* tag_closing
// ) {
//   AST_HTML_OPEN_TAG_NODE_T* open_tag = malloc(sizeof(AST_HTML_OPEN_TAG_NODE_T));
//
//   ast_node_init(&open_tag->base, AST_HTML_OPEN_TAG_NODE);
//
//   open_tag->base.children = children;
//   open_tag->attributes = attributes;
//   open_tag->tag_opening = tag_opening;
//   open_tag->tag_name = tag_name;
//   open_tag->tag_closing = tag_closing;
//
//   ast_node_set_start(&open_tag->base, open_tag->tag_opening->start);
//   ast_node_set_end(&open_tag->base, open_tag->tag_closing->end);
//
//   return open_tag;
// }
//
// // AST_HTML_SELF_CLOSE_TAG_NODE_T* ast_html_self_close_tag_node_init(AST_HTML_ATTRIBUTE_SET_NODE_T attributes,
// token_T*
// // tag_opening, token_T* tag_closing) {
// //   AST_HTML_SELF_CLOSE_TAG_NODE_T* open_tag =
// //   (AST_HTML_SELF_CLOSE_TAG_NODE_T*)ast_node_init(AST_HTML_SELF_CLOSE_TAG_NODE); open_tag->attributes =
// &attributes;
// //   open_tag->tag_opening = tag_opening;
// //   open_tag->tag_closing = tag_closing;
// //   return open_tag;
// // }
//
// AST_HTML_CLOSE_TAG_NODE_T* ast_html_close_tag_node_init(token_T* tag_opening, token_T* tag_name, token_T*
// tag_closing) {
//   AST_HTML_CLOSE_TAG_NODE_T* close_tag = malloc(sizeof(AST_HTML_CLOSE_TAG_NODE_T));
//
//   ast_node_init(&close_tag->base, AST_HTML_CLOSE_TAG_NODE);
//
//   close_tag->tag_opening = tag_opening;
//   close_tag->tag_name = tag_name;
//   close_tag->tag_closing = tag_closing;
//
//   ast_node_set_start(&close_tag->base, close_tag->tag_opening->start);
//   ast_node_set_end(&close_tag->base, close_tag->tag_closing->end);
//
//   return close_tag;
// }
//
// AST_HTML_COMMENT_NODE_T* ast_html_comment_node_init(token_T* comment_start, array_T* children, token_T* comment_end)
// {
//   AST_HTML_COMMENT_NODE_T* comment = malloc(sizeof(AST_HTML_COMMENT_NODE_T));
//
//   ast_node_init(&comment->base, AST_HTML_COMMENT_NODE);
//
//   comment->comment_start = comment_start;
//   comment->base.children = children;
//   comment->comment_end = comment_end;
//
//   return comment;
// }
//
// AST_ERB_CONTENT_NODE_T* ast_erb_content_node_init(token_T* tag_opening, token_T* content, token_T* tag_closing) {
//   AST_ERB_CONTENT_NODE_T* erb = malloc(sizeof(AST_ERB_CONTENT_NODE_T));
//
//   ast_node_init(&erb->base, AST_ERB_CONTENT_NODE);
//
//   erb->tag_opening = tag_opening;
//   erb->content = content;
//   erb->tag_closing = tag_closing;
//
//   ast_node_set_start(&erb->base, erb->tag_opening->start);
//   ast_node_set_end(&erb->base, erb->tag_closing->end);
//
//   return erb;
// }
//
// AST_HTML_TEXT_NODE_T* ast_html_text_node_init(const char* content) {
//   AST_HTML_TEXT_NODE_T* text_node = malloc(sizeof(AST_HTML_TEXT_NODE_T));
//
//   ast_node_init(&text_node->base, AST_HTML_TEXT_NODE);
//
//   text_node->content = erbx_strdup(content);
//
//   return text_node;
// }
//
// AST_HTML_DOCTYPE_NODE_T* ast_html_doctype_node_init(token_T* tag_opening, array_T* children, token_T* tag_closing) {
//   AST_HTML_DOCTYPE_NODE_T* doctype = malloc(sizeof(AST_HTML_DOCTYPE_NODE_T));
//
//   ast_node_init(&doctype->base, AST_HTML_DOCTYPE_NODE);
//
//   doctype->tag_opening = tag_opening;
//   doctype->base.children = children;
//   doctype->tag_closing = tag_closing;
//
//   ast_node_set_start(&doctype->base, doctype->tag_opening->start);
//   ast_node_set_end(&doctype->base, doctype->tag_closing->end);
//
//   return doctype;
// }
//
// AST_DOCUMENT_NODE_T* ast_html_document_node_init(void) {
//   AST_DOCUMENT_NODE_T* document_node = malloc(sizeof(AST_DOCUMENT_NODE_T));
//
//   ast_node_init(&document_node->base, AST_DOCUMENT_NODE);
//
//   return document_node;
// }
//
// AST_HTML_ATTRIBUTE_SET_NODE_T* ast_html_attribute_set_node_init(void) {
//   AST_HTML_ATTRIBUTE_SET_NODE_T* attributes_set = malloc(sizeof(AST_HTML_ATTRIBUTE_SET_NODE_T));
//
//   ast_node_init(&attributes_set->base, AST_HTML_ATTRIBUTE_SET_NODE);
//   attributes_set->attributes = array_init(ast_node_sizeof());
//
//   return attributes_set;
// }
//
// AST_HTML_ATTRIBUTE_NODE_T* ast_html_attribute_node_init(
//   AST_HTML_ATTRIBUTE_NAME_NODE_T* name, token_T* equals, AST_HTML_ATTRIBUTE_VALUE_NODE_T* value
// ) {
//   AST_HTML_ATTRIBUTE_NODE_T* attribute = malloc(sizeof(AST_HTML_ATTRIBUTE_NODE_T));
//
//   ast_node_init(&attribute->base, AST_HTML_ATTRIBUTE_NODE);
//
//   attribute->name = name;
//   attribute->equals = equals;
//   attribute->value = value;
//
//   ast_node_set_start(&attribute->base, attribute->name->base.start);
//
//   if (value != NULL) {
//     ast_node_set_end(&attribute->base, attribute->value->base.end);
//   } else {
//     ast_node_set_end(&attribute->base, attribute->name->base.end);
//   }
//
//   return attribute;
// }
//
// AST_HTML_ATTRIBUTE_NAME_NODE_T* ast_html_attribute_name_node_init(token_T* name) {
//   AST_HTML_ATTRIBUTE_NAME_NODE_T* name_node = malloc(sizeof(AST_HTML_ATTRIBUTE_NAME_NODE_T));
//   ast_node_init(&name_node->base, AST_HTML_ATTRIBUTE_NAME_NODE);
//
//   name_node->name = name;
//
//   ast_node_set_start(&name_node->base, name_node->name->start);
//   ast_node_set_end(&name_node->base, name_node->name->end);
//
//   return name_node;
// }
//
// AST_HTML_ATTRIBUTE_VALUE_NODE_T* ast_html_attribute_value_node_init(
//   token_T* open_quote, array_T* children, token_T* close_quote
// ) {
//   AST_HTML_ATTRIBUTE_VALUE_NODE_T* value = malloc(sizeof(AST_HTML_ATTRIBUTE_VALUE_NODE));
//   ast_node_init(&value->base, AST_HTML_ATTRIBUTE_VALUE_NODE);
//
//   value->quoted = open_quote != NULL && close_quote != NULL;
//   value->open_quote = open_quote;
//   value->close_quote = close_quote;
//
//   if (children != NULL) { value->base.children = children; }
//
//   if (value->quoted) {
//     ast_node_set_start(&value->base, value->open_quote->start);
//     ast_node_set_end(&value->base, value->close_quote->end);
//   } else if (array_size(children) > 0) {
//     AST_NODE_T* first = array_first(value->base.children);
//     AST_NODE_T* last = array_last(value->base.children);
//
//     if (first != NULL) { ast_node_set_start(&value->base, first->start); };
//     if (last != NULL) { ast_node_set_end(&value->base, last->end); };
//   }
//
//   return value;
// }
//
// AST_UNEXPECTED_TOKEN_NODE_T* ast_unexpected_node_init(const char* message, const char* expected, const char* got) {
//   AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token = malloc(sizeof(AST_UNEXPECTED_TOKEN_NODE_T));
//
//   ast_node_init(&unexpected_token->base, AST_UNEXPECTED_TOKEN_NODE);
//
//   unexpected_token->message = message;
//   unexpected_token->expected = expected;
//   unexpected_token->got = got;
//
//   return unexpected_token;
// }

ast_node_type_T ast_node_type(AST_NODE_T* node) {
  return node->type;
}

size_t ast_node_errors_count(AST_NODE_T* node) {
  return array_size(node->errors);
}

array_T* ast_node_errors(AST_NODE_T* node) {
  return node->errors;
}

void ast_node_set_start(AST_NODE_T* node, location_T* location) {
  // if (node->start != NULL) { location_free(node->start); }

  node->start = location_copy(location);
}

void ast_node_set_end(AST_NODE_T* node, location_T* location) {
  // if (node->end != NULL) { location_free(node->end); }

  node->end = location_copy(location);
}

void ast_node_set_start_from_token(AST_NODE_T* node, token_T* token) {
  ast_node_set_start(node, token->start);
}

void ast_node_set_end_from_token(AST_NODE_T* node, token_T* token) {
  ast_node_set_end(node, token->end);
}

void ast_node_set_locations_from_token(AST_NODE_T* node, token_T* token) {
  ast_node_set_start_from_token(node, token);
  ast_node_set_end_from_token(node, token);
}
