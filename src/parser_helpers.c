#include "include/parser_helpers.h"
#include "include/ast_nodes.h"
#include "include/errors.h"
#include "include/lexer.h"
#include "include/parser.h"
#include "include/token.h"
#include "include/util/hb_array.h"
#include "include/util/hb_buffer.h"
#include "include/util/hb_string.h"

#include <stdarg.h>
#include <stdio.h>

void parser_push_open_tag(const parser_T* parser, token_T* tag_name) {
  token_T* copy = token_copy(tag_name);
  hb_array_push(parser->open_tags_stack, copy);
}

bool parser_check_matching_tag(const parser_T* parser, hb_string_T tag_name) {
  if (hb_array_size(parser->open_tags_stack) == 0) { return false; }

  token_T* top_token = hb_array_last(parser->open_tags_stack);
  if (top_token == NULL || top_token->value == NULL) { return false; };

  return hb_string_equals_case_insensitive(hb_string(top_token->value), tag_name);
}

token_T* parser_pop_open_tag(const parser_T* parser) {
  if (hb_array_size(parser->open_tags_stack) == 0) { return NULL; }

  return hb_array_pop(parser->open_tags_stack);
}

/**
 * Checks if any element in the open tags stack is an SVG element.
 *
 * @param parser The parser containing the open tags stack.
 * @return true if an SVG tag is found in the stack, false otherwise.
 */
bool parser_in_svg_context(const parser_T* parser) {
  if (!parser || !parser->open_tags_stack) { return false; }

  size_t stack_size = hb_array_size(parser->open_tags_stack);

  for (size_t i = 0; i < stack_size; i++) {
    token_T* tag = (token_T*) hb_array_get(parser->open_tags_stack, i);

    if (tag && tag->value) {
      hb_string_T tag_value_string = hb_string(tag->value);
      if (hb_string_equals_case_insensitive(tag_value_string, hb_string("svg"))) { return true; }
    }
  }

  return false;
}

// ===== Foreign Content Handling =====

foreign_content_type_T parser_get_foreign_content_type(hb_string_T tag_name) {
  if (hb_string_is_empty(tag_name)) { return FOREIGN_CONTENT_UNKNOWN; }

  if (hb_string_equals_case_insensitive(tag_name, hb_string("script"))) { return FOREIGN_CONTENT_SCRIPT; }
  if (hb_string_equals_case_insensitive(tag_name, hb_string("style"))) { return FOREIGN_CONTENT_STYLE; }

  return FOREIGN_CONTENT_UNKNOWN;
}

bool parser_is_foreign_content_tag(hb_string_T tag_name) {
  return parser_get_foreign_content_type(tag_name) != FOREIGN_CONTENT_UNKNOWN;
}

hb_string_T parser_get_foreign_content_closing_tag(foreign_content_type_T type) {
  switch (type) {
    case FOREIGN_CONTENT_SCRIPT: return hb_string("script");
    case FOREIGN_CONTENT_STYLE: return hb_string("style");
    default: return hb_string("");
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

void parser_append_unexpected_error_impl(
  parser_T* parser,
  hb_array_T* errors,
  const char* description,
  token_type_T first_token,
  ...
) {
  token_T* token = parser_advance(parser);

  va_list args;
  va_start(args, first_token);
  char* expected = token_types_to_friendly_string_valist(first_token, args);
  va_end(args);

  append_unexpected_error(
    description,
    expected,
    token_type_to_friendly_string(token->type),
    token->location.start,
    token->location.end,
    errors
  );

  free(expected);
  token_free(token);
}

void parser_append_unexpected_error_string(
  parser_T* parser,
  hb_array_T* errors,
  const char* description,
  const char* expected
) {
  token_T* token = parser_advance(parser);

  append_unexpected_error(
    description,
    expected,
    token_type_to_friendly_string(token->type),
    token->location.start,
    token->location.end,
    errors
  );

  token_free(token);
}

void parser_append_unexpected_token_error(parser_T* parser, token_type_T expected_type, hb_array_T* errors) {
  append_unexpected_token_error(
    expected_type,
    parser->current_token,
    parser->current_token->location.start,
    parser->current_token->location.end,
    errors
  );
}

void parser_append_literal_node_from_buffer(
  const parser_T* parser,
  hb_buffer_T* buffer,
  hb_array_T* children,
  position_T start
) {
  if (hb_buffer_length(buffer) == 0) { return; }

  AST_LITERAL_NODE_T* literal =
    ast_literal_node_init(hb_buffer_value(buffer), start, parser->current_token->location.start, NULL);

  if (children != NULL) { hb_array_append(children, literal); }
  hb_buffer_clear(buffer);
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

token_T* parser_consume_expected(parser_T* parser, const token_type_T expected_type, hb_array_T* array) {
  token_T* token = parser_consume_if_present(parser, expected_type);

  if (token == NULL) {
    token = parser_advance(parser);

    append_unexpected_token_error(expected_type, token, token->location.start, token->location.end, array);
  }

  return token;
}

AST_HTML_ELEMENT_NODE_T* parser_handle_missing_close_tag(
  AST_HTML_OPEN_TAG_NODE_T* open_tag,
  hb_array_T* body,
  hb_array_T* errors
) {
  append_missing_closing_tag_error(
    open_tag->tag_name,
    open_tag->tag_name->location.start,
    open_tag->tag_name->location.end,
    errors
  );

  return ast_html_element_node_init(
    (AST_NODE_T*) open_tag,
    open_tag->tag_name,
    body,
    NULL,
    false,
    ELEMENT_SOURCE_HTML,
    open_tag->base.location.start,
    open_tag->base.location.end,
    errors
  );
}

void parser_handle_mismatched_tags(
  const parser_T* parser,
  const AST_HTML_CLOSE_TAG_NODE_T* close_tag,
  hb_array_T* errors
) {
  if (hb_array_size(parser->open_tags_stack) > 0) {
    token_T* expected_tag = hb_array_last(parser->open_tags_stack);
    token_T* actual_tag = close_tag->tag_name;

    append_tag_names_mismatch_error(
      expected_tag,
      actual_tag,
      actual_tag->location.start,
      actual_tag->location.end,
      errors
    );
  } else {
    append_missing_opening_tag_error(
      close_tag->tag_name,
      close_tag->tag_name->location.start,
      close_tag->tag_name->location.end,
      errors
    );
  }
}

bool parser_is_expected_closing_tag_name(hb_string_T tag_name, foreign_content_type_T expected_type) {
  hb_string_T expected_tag_name = parser_get_foreign_content_closing_tag(expected_type);

  if (hb_string_is_empty(tag_name) || hb_string_is_empty(expected_tag_name)) { return false; }

  return hb_string_equals_case_insensitive(expected_tag_name, tag_name);
}

void parser_synchronize(parser_T* parser, hb_array_T* errors) {
  (void) errors;

  while (parser->current_token->type != TOKEN_EOF) {
    token_type_T type = parser->current_token->type;

    if (type == TOKEN_HTML_TAG_START || type == TOKEN_HTML_TAG_START_CLOSE || type == TOKEN_ERB_START
        || type == TOKEN_HTML_COMMENT_START || type == TOKEN_HTML_DOCTYPE) {
      return;
    }

    token_T* skipped = parser_advance(parser);
    token_free(skipped);
  }
}

bool parser_can_close_ancestor(const parser_T* parser, hb_string_T tag_name) {
  size_t stack_size = hb_array_size(parser->open_tags_stack);

  for (size_t i = stack_size; i > 0; i--) {
    token_T* open = hb_array_get(parser->open_tags_stack, i - 1);

    if (open && open->value && hb_string_equals_case_insensitive(hb_string(open->value), tag_name)) { return true; }
  }

  return false;
}

size_t parser_find_ancestor_depth(const parser_T* parser, hb_string_T tag_name) {
  size_t stack_size = hb_array_size(parser->open_tags_stack);

  for (size_t i = stack_size; i > 0; i--) {
    token_T* open = hb_array_get(parser->open_tags_stack, i - 1);

    if (open && open->value && hb_string_equals_case_insensitive(hb_string(open->value), tag_name)) {
      return stack_size - i;
    }
  }

  return (size_t) -1;
}
