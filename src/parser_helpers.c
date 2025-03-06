#include "include/parser_helpers.h"
#include "include/array.h"
#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/buffer.h"
#include "include/errors.h"
#include "include/html_util.h"
#include "include/lexer.h"
#include "include/parser.h"
#include "include/token.h"

#include <stdio.h>
#include <strings.h>

void parser_push_open_tag(const parser_T* parser, token_T* tag_name) {
  token_T* copy = token_copy(tag_name);
  array_push(parser->open_tags_stack, copy);
}

bool parser_check_matching_tag(const parser_T* parser, const char* tag_name) {
  if (array_size(parser->open_tags_stack) == 0) { return false; }

  token_T* top_token = array_last(parser->open_tags_stack);
  if (top_token == NULL || top_token->value == NULL) { return false; };

  return (strcasecmp(top_token->value, tag_name) == 0);
}

token_T* parser_pop_open_tag(const parser_T* parser) {
  if (array_size(parser->open_tags_stack) == 0) { return NULL; }

  return array_pop(parser->open_tags_stack);
}

void parser_append_unexpected_error(parser_T* parser, const char* description, const char* expected, array_T* errors) {
  token_T* token = parser_advance(parser);

  append_unexpected_error(description, expected, token_type_to_string(token->type), token->start, token->end, errors);

  token_free(token);
}

void parser_append_unexpected_token_error(parser_T* parser, token_type_T expected_type, array_T* errors) {
  append_unexpected_token_error(
    expected_type,
    parser->current_token,
    parser->current_token->start,
    parser->current_token->end,
    errors
  );
}

void parser_append_literal_node_from_buffer(
  const parser_T* parser, buffer_T* buffer, array_T* children, location_T* start_location
) {
  if (buffer_length(buffer) == 0) { return; }

  AST_LITERAL_NODE_T* literal =
    ast_literal_node_init(buffer_value(buffer), start_location, parser->current_token->start, NULL);

  if (children != NULL) { array_append(children, literal); }
  buffer_clear(buffer);
}

token_T* parser_advance(parser_T* parser) {
  token_T* token = parser->current_token;
  parser->current_token = lexer_next_token(parser->lexer);
  return token;
}

token_T* parser_consume_if_present(parser_T* parser, const token_type_T type) {
  if (parser->current_token->type != type) { return NULL; }
  return parser_advance(parser);
}

token_T* parser_consume_expected(parser_T* parser, const token_type_T expected_type, array_T* array) {
  token_T* token = parser_consume_if_present(parser, expected_type);

  if (token == NULL) {
    token = parser_advance(parser);

    append_unexpected_token_error(expected_type, token, token->start, token->end, array);
  }

  return token;
}

AST_HTML_ELEMENT_NODE_T* parser_handle_missing_close_tag(
  AST_HTML_OPEN_TAG_NODE_T* open_tag, array_T* body, array_T* errors
) {
  append_missing_closing_tag_error(open_tag->tag_name, open_tag->tag_name->start, open_tag->tag_name->end, errors);

  return ast_html_element_node_init(
    open_tag,
    open_tag->tag_name,
    body,
    NULL,
    false,
    open_tag->base.start,
    open_tag->base.end,
    errors
  );
}

void parser_handle_mismatched_tags(
  const parser_T* parser, const AST_HTML_CLOSE_TAG_NODE_T* close_tag, array_T* errors
) {
  if (array_size(parser->open_tags_stack) > 0) {
    token_T* expected_tag = array_last(parser->open_tags_stack);
    token_T* actual_tag = close_tag->tag_name;

    append_mismatched_tag_name_error(
      expected_tag->value,
      expected_tag->start,
      actual_tag,
      actual_tag->start,
      actual_tag->end,
      errors
    );
  } else {
    append_missing_opening_tag_error(close_tag->tag_name, close_tag->tag_name->start, close_tag->tag_name->end, errors);
  }
}
