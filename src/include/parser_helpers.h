#ifndef HERB_PARSER_HELPERS_H
#define HERB_PARSER_HELPERS_H

#include "ast_nodes.h"
#include "errors.h"
#include "parser.h"
#include "token.h"
#include "util/hb_array.h"
#include "util/hb_buffer.h"

void parser_push_open_tag(const parser_T* parser, token_T* tag_name);
bool parser_check_matching_tag(const parser_T* parser, const char* tag_name);
token_T* parser_pop_open_tag(const parser_T* parser);

void parser_append_unexpected_error(
  parser_T* parser,
  const char* description,
  const char* expected,
  hb_array_T* errors
);
void parser_append_unexpected_token_error(parser_T* parser, token_type_T expected_type, hb_array_T* errors);

void parser_append_literal_node_from_buffer(
  const parser_T* parser,
  hb_buffer_T* buffer,
  hb_array_T* children,
  position_T start
);

bool parser_in_svg_context(const parser_T* parser);

foreign_content_type_T parser_get_foreign_content_type(const char* tag_name);
bool parser_is_foreign_content_tag(const char* tag_name);
const char* parser_get_foreign_content_closing_tag(foreign_content_type_T type);

void parser_enter_foreign_content(parser_T* parser, foreign_content_type_T type);
void parser_exit_foreign_content(parser_T* parser);

bool parser_is_expected_closing_tag_name(const char* tag_name, foreign_content_type_T expected_type);

token_T* parser_advance(parser_T* parser);
token_T* parser_consume_if_present(parser_T* parser, token_type_T type);
token_T* parser_consume_expected(parser_T* parser, token_type_T type, hb_array_T* array);

AST_HTML_ELEMENT_NODE_T* parser_handle_missing_close_tag(
  AST_HTML_OPEN_TAG_NODE_T* open_tag,
  hb_array_T* body,
  hb_array_T* errors
);
void parser_handle_mismatched_tags(
  const parser_T* parser,
  const AST_HTML_CLOSE_TAG_NODE_T* close_tag,
  hb_array_T* errors
);

#endif
