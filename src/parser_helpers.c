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
#include "include/token_matchers.h"

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

/**
 * Checks if any element in the open tags stack is an SVG element.
 *
 * @param parser The parser containing the open tags stack.
 * @return true if an SVG tag is found in the stack, false otherwise.
 */
bool parser_in_svg_context(const parser_T* parser) {
  if (!parser || !parser->open_tags_stack) { return false; }

  size_t stack_size = array_size(parser->open_tags_stack);

  for (size_t i = 0; i < stack_size; i++) {
    token_T* tag = (token_T*) array_get(parser->open_tags_stack, i);

    if (tag && tag->value) {
      if (strcasecmp(tag->value, "svg") == 0) { return true; }
    }
  }

  return false;
}

// ===== Foreign Content Handling =====

foreign_content_type_T parser_get_foreign_content_type(const char* tag_name) {
  if (tag_name == NULL) { return FOREIGN_CONTENT_UNKNOWN; }

  if (strcasecmp(tag_name, "script") == 0) { return FOREIGN_CONTENT_SCRIPT; }
  if (strcasecmp(tag_name, "style") == 0) { return FOREIGN_CONTENT_STYLE; }

  return FOREIGN_CONTENT_UNKNOWN;
}

bool parser_is_foreign_content_tag(const char* tag_name) {
  return parser_get_foreign_content_type(tag_name) != FOREIGN_CONTENT_UNKNOWN;
}

const char* parser_get_foreign_content_closing_tag(foreign_content_type_T type) {
  switch (type) {
    case FOREIGN_CONTENT_SCRIPT: return "script";
    case FOREIGN_CONTENT_STYLE: return "style";
    default: return NULL;
  }
}

void parser_enter_foreign_content(parser_T* parser, foreign_content_type_T type) {
  if (parser == NULL) { return; }

  parser->state = PARSER_STATE_FOREIGN_CONTENT;
  parser->foreign_content_type = type;
}

void parser_exit_foreign_content(parser_T* parser) {
  if (parser == NULL) { return; }

  parser->state = PARSER_STATE_DATA;
  parser->foreign_content_type = FOREIGN_CONTENT_UNKNOWN;
}

void parser_append_unexpected_error(parser_T* parser, const char* description, const char* expected, array_T* errors) {
  token_T* token = parser_advance(parser);

  append_unexpected_error(
    description,
    expected,
    token_type_to_string(token->type),
    token->location->start,
    token->location->end,
    errors
  );

  token_free(token);
}

void parser_append_unexpected_token_error(parser_T* parser, token_type_T expected_type, array_T* errors) {
  append_unexpected_token_error(
    expected_type,
    parser->current_token,
    parser->current_token->location->start,
    parser->current_token->location->end,
    errors
  );
}

void parser_append_literal_node_from_buffer(
  const parser_T* parser,
  buffer_T* buffer,
  array_T* children,
  position_T* start
) {
  if (buffer_length(buffer) == 0) { return; }

  AST_LITERAL_NODE_T* literal =
    ast_literal_node_init(buffer_value(buffer), start, parser->current_token->location->start, NULL);

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

    append_unexpected_token_error(expected_type, token, token->location->start, token->location->end, array);
  }

  return token;
}

AST_HTML_ELEMENT_NODE_T* parser_handle_missing_close_tag(
  AST_HTML_OPEN_TAG_NODE_T* open_tag,
  array_T* body,
  array_T* errors
) {
  append_missing_closing_tag_error(
    open_tag->tag_name,
    open_tag->tag_name->location->start,
    open_tag->tag_name->location->end,
    errors
  );

  return ast_html_element_node_init(
    open_tag,
    open_tag->tag_name,
    body,
    NULL,
    false,
    ELEMENT_SOURCE_HTML,
    open_tag->base.location->start,
    open_tag->base.location->end,
    errors
  );
}

void parser_handle_mismatched_tags(
  const parser_T* parser,
  const AST_HTML_CLOSE_TAG_NODE_T* close_tag,
  array_T* errors
) {
  if (array_size(parser->open_tags_stack) > 0) {
    token_T* expected_tag = array_last(parser->open_tags_stack);
    token_T* actual_tag = close_tag->tag_name;

    append_tag_names_mismatch_error(
      expected_tag,
      actual_tag,
      actual_tag->location->start,
      actual_tag->location->end,
      errors
    );
  } else {
    append_missing_opening_tag_error(
      close_tag->tag_name,
      close_tag->tag_name->location->start,
      close_tag->tag_name->location->end,
      errors
    );
  }
}

bool parser_is_expected_closing_tag_name(const char* tag_name, foreign_content_type_T expected_type) {
  const char* expected_tag_name = parser_get_foreign_content_closing_tag(expected_type);

  if (expected_tag_name == NULL || tag_name == NULL) { return false; }

  return strcmp(tag_name, expected_tag_name) == 0;
}
