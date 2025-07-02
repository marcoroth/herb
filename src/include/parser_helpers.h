#ifndef HERB_PARSER_HELPERS_H
#define HERB_PARSER_HELPERS_H

#include "array.h"
#include "ast_nodes.h"
#include "buffer.h"
#include "errors.h"
#include "parser.h"
#include "token.h"

void parser_push_open_tag(const parser_T* parser, token_T* tag_name);
bool parser_check_matching_tag(const parser_T* parser, const char* tag_name);
token_T* parser_pop_open_tag(const parser_T* parser);

void parser_append_unexpected_error(parser_T* parser, const char* description, const char* expected, array_T* errors);
void parser_append_unexpected_token_error(parser_T* parser, token_type_T expected_type, array_T* errors);

void parser_append_literal_node_from_buffer(
  const parser_T* parser,
  buffer_T* buffer,
  array_T* children,
  position_T* start
);

bool parser_in_svg_context(const parser_T* parser);

token_T* parser_advance(parser_T* parser);
token_T* parser_consume_if_present(parser_T* parser, token_type_T type);
token_T* parser_consume_expected(parser_T* parser, token_type_T type, array_T* array);

AST_HTML_ELEMENT_NODE_T* parser_handle_missing_close_tag(
  AST_HTML_OPEN_TAG_NODE_T* open_tag,
  array_T* body,
  array_T* errors
);
void parser_handle_mismatched_tags(const parser_T* parser, const AST_HTML_CLOSE_TAG_NODE_T* close_tag, array_T* errors);

#endif
