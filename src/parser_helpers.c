#include "include/parser_helpers.h"
#include "include/array.h"
#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/buffer.h"
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

AST_UNEXPECTED_TOKEN_NODE_T* parser_init_unexpected_token(parser_T* parser) {
  token_T* token = parser_advance(parser);
  const char* actual_type = token_type_to_string(token->type);

  size_t length = snprintf(NULL, 0, "not %s", actual_type) + 1;
  char* expected = malloc(length);

  if (expected != NULL) {
    snprintf(expected, length, "not %s", actual_type);

    AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = ast_unexpected_token_node_init_from_token(token, expected);

    free(expected);
    token_free(token);

    return unexpected_token_node;
  } else {
    printf("unexpected token type: %s\n", token_type_to_string(token->type));
    token_free(token);

    return NULL;
  }
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

token_T* parser_consume_expected(parser_T* parser, const token_type_T type, array_T* array) {
  token_T* token = parser_consume_if_present(parser, type);

  if (token == NULL) {
    token = parser_advance(parser);

    AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = ast_unexpected_token_node_init_from_raw_message(
      token->start,
      token->end,
      "in parser_consume_expected",
      (char*) token_type_to_string(type),
      (char*) token_type_to_string(token->type)
    );

    if (array != NULL) {
      array_append(array, unexpected_token_node);
    } else {
      printf("%s\n", unexpected_token_node->message);
      ast_node_free((AST_NODE_T*) unexpected_token_node);
    }
  }

  return token;
}

AST_HTML_ELEMENT_NODE_T* parser_handle_missing_close_tag(
  AST_HTML_OPEN_TAG_NODE_T* open_tag, array_T* body, array_T* errors
) {
  char* expected = html_closing_tag_string(open_tag->tag_name->value);
  AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = ast_unexpected_token_node_init_from_raw_message(
    open_tag->base.start,
    open_tag->base.end,
    "expected element to have a close tag",
    expected,
    ""
  );
  free(expected);
  array_append(errors, unexpected_token_node);

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
    token_T* expected_token = array_last(parser->open_tags_stack);
    char error_message[256];
    snprintf(
      error_message,
      sizeof(error_message),
      "mismatched closing tag, expected closing tag for '%s' (opened at %zu:%zu)",
      expected_token->value,
      expected_token->start->line,
      expected_token->start->column
    );
    AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = ast_unexpected_token_node_init_from_raw_message(
      close_tag->base.start,
      close_tag->base.end,
      error_message,
      expected_token->value,
      close_tag->tag_name->value
    );
    array_append(errors, unexpected_token_node);
  } else {
    char* expected = html_opening_tag_string(close_tag->tag_name->value);
    AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = ast_unexpected_token_node_init_from_raw_message(
      close_tag->base.start,
      close_tag->base.end,
      "closing tag with no matching open tag",
      expected,
      ""
    );
    free(expected);
    array_append(errors, unexpected_token_node);
  }
}
