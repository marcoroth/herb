#include "include/parser.h"
#include "include/array.h"
#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/buffer.h"
#include "include/html_util.h"
#include "include/lexer.h"
#include "include/token.h"
#include "include/token_matchers.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

static void parser_parse_in_data_state(parser_T* parser, array_T* children, array_T* errors);
static AST_ERB_CONTENT_NODE_T* parser_parse_erb_tag(parser_T* parser);
static token_T* parser_advance(parser_T* parser);

size_t parser_sizeof(void) {
  return sizeof(struct PARSER_STRUCT);
}

parser_T* parser_init(lexer_T* lexer) {
  parser_T* parser = calloc(1, parser_sizeof());

  parser->lexer = lexer;
  parser->current_token = lexer_next_token(lexer);
  parser->open_tags_stack = array_init(16);

  return parser;
}

static void parser_push_open_tag(parser_T* parser, token_T* tag_name) {
  token_T* copy = token_copy(tag_name);
  array_push(parser->open_tags_stack, copy);
}

static bool parser_check_matching_tag(parser_T* parser, const char* tag_name) {
  if (array_size(parser->open_tags_stack) == 0) { return false; }

  token_T* top_token = array_last(parser->open_tags_stack);
  if (top_token == NULL || top_token->value == NULL) { return false; };

  return (strcasecmp(top_token->value, tag_name) == 0);
}

static token_T* parser_pop_open_tag(parser_T* parser) {
  if (array_size(parser->open_tags_stack) == 0) { return NULL; }

  return array_pop(parser->open_tags_stack);
}

static AST_UNEXPECTED_TOKEN_NODE_T* parser_init_unexpected_token(parser_T* parser) {
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

static void parser_append_literal_node_from_buffer(
  const parser_T* parser, buffer_T* buffer, array_T* children, location_T* start_location
) {
  if (buffer_length(buffer) == 0) { return; }

  AST_LITERAL_NODE_T* literal =
    ast_literal_node_init(buffer_value(buffer), start_location, parser->current_token->start, NULL);

  if (children != NULL) { array_append(children, literal); }
  buffer_clear(buffer);
}

static token_T* parser_advance(parser_T* parser) {
  token_T* token = parser->current_token;
  parser->current_token = lexer_next_token(parser->lexer);
  return token;
}

static token_T* parser_consume_if_present(parser_T* parser, const token_type_T type) {
  if (parser->current_token->type != type) { return NULL; }
  return parser_advance(parser);
}

static token_T* parser_consume_expected(parser_T* parser, const token_type_T type, array_T* array) {
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

static AST_HTML_COMMENT_NODE_T* parser_parse_html_comment(parser_T* parser) {
  array_T* errors = array_init(8);
  array_T* children = array_init(8);
  token_T* comment_start = parser_consume_expected(parser, TOKEN_HTML_COMMENT_START, errors);
  location_T* start_location = location_copy(parser->current_token->start);

  buffer_T comment = buffer_new();

  while (token_is_none_of(parser, TOKEN_HTML_COMMENT_END, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &comment, children, start_location);

      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      array_append(children, erb_node);

      location_free(start_location);
      start_location = location_copy(parser->current_token->start);

      continue;
    }

    token_T* token = parser_advance(parser);
    buffer_append(&comment, token->value);
    token_free(token);
  }

  parser_append_literal_node_from_buffer(parser, &comment, children, start_location);

  token_T* comment_end = parser_consume_expected(parser, TOKEN_HTML_COMMENT_END, errors);

  AST_HTML_COMMENT_NODE_T* comment_node =
    ast_html_comment_node_init(comment_start, children, comment_end, comment_start->start, comment_end->end, errors);

  buffer_free(&comment);
  location_free(start_location);
  token_free(comment_start);
  token_free(comment_end);

  return comment_node;
}

static AST_HTML_DOCTYPE_NODE_T* parser_parse_html_doctype(parser_T* parser) {
  array_T* errors = array_init(8);
  array_T* children = array_init(8);
  buffer_T content = buffer_new();

  token_T* tag_opening = parser_consume_expected(parser, TOKEN_HTML_DOCTYPE, errors);

  location_T* start_location = location_copy(parser->current_token->start);

  while (token_is_none_of(parser, TOKEN_HTML_TAG_END, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &content, children, start_location);

      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      array_append(children, erb_node);

      continue;
    }

    token_T* token = parser_consume_expected(parser, parser->current_token->type, errors);
    buffer_append(&content, token->value);
    token_free(token);
  }

  parser_append_literal_node_from_buffer(parser, &content, children, start_location);

  token_T* tag_closing = parser_consume_expected(parser, TOKEN_HTML_TAG_END, errors);

  AST_HTML_DOCTYPE_NODE_T* doctype =
    ast_html_doctype_node_init(tag_opening, children, tag_closing, tag_opening->start, tag_closing->end, errors);

  location_free(start_location);
  token_free(tag_opening);
  token_free(tag_closing);
  buffer_free(&content);

  return doctype;
}

static AST_HTML_TEXT_NODE_T* parser_parse_text_content(parser_T* parser) {
  location_T* start_location = location_copy(parser->current_token->start);

  array_T* errors = array_init(8);
  buffer_T content = buffer_new();

  while (token_is_none_of(
    parser,
    TOKEN_HTML_TAG_START,
    TOKEN_HTML_TAG_START_CLOSE,
    TOKEN_HTML_DOCTYPE,
    TOKEN_HTML_COMMENT_START,
    TOKEN_ERB_START,
    TOKEN_EOF
  )) {
    if (token_is(parser, TOKEN_ERROR)) {
      buffer_free(&content);

      token_T* token = parser_consume_expected(parser, TOKEN_ERROR, errors);
      AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node =
        ast_unexpected_token_node_init_from_token(token, "not TOKEN_ERROR");
      token_free(token);

      array_append(errors, unexpected_token_node);

      return NULL;
    }

    token_T* token = parser_advance(parser);
    buffer_append(&content, token->value);
    token_free(token);
  }

  if (buffer_length(&content) > 0) {
    AST_HTML_TEXT_NODE_T* text_node =
      ast_html_text_node_init(buffer_value(&content), start_location, parser->current_token->start, errors);

    location_free(start_location);
    buffer_free(&content);

    return text_node;
  }

  AST_HTML_TEXT_NODE_T* text_node = ast_html_text_node_init("", start_location, parser->current_token->start, errors);

  location_free(start_location);
  buffer_free(&content);

  return text_node;
}

static AST_HTML_ATTRIBUTE_NAME_NODE_T* parser_parse_html_attribute_name(parser_T* parser) {
  array_T* errors = array_init(8);
  token_T* identifier = parser_consume_if_present(parser, TOKEN_IDENTIFIER);

  if (identifier == NULL) {
    array_append(errors, ast_unexpected_token_node_init_from_token(identifier, "TOKEN_IDENTIFIER"));
  }

  AST_HTML_ATTRIBUTE_NAME_NODE_T* attribute_name =
    ast_html_attribute_name_node_init(identifier, identifier->start, identifier->end, errors);

  token_free(identifier);

  return attribute_name;
}

static AST_HTML_ATTRIBUTE_VALUE_NODE_T* parser_parse_quoted_html_attribute_value(
  parser_T* parser, array_T* children, array_T* errors
) {
  buffer_T buffer = buffer_new();
  token_T* open_quote = parser_consume_expected(parser, TOKEN_QUOTE, errors);
  location_T* start_location = location_copy(parser->current_token->start);

  while (token_is_none_of(parser, TOKEN_QUOTE, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &buffer, children, start_location);

      array_append(children, parser_parse_erb_tag(parser));

      location_free(start_location);
      start_location = location_copy(parser->current_token->start);

      continue;
    }

    buffer_append(&buffer, parser->current_token->value);
    token_free(parser->current_token);
    parser->current_token = lexer_next_token(parser->lexer);
  }

  parser_append_literal_node_from_buffer(parser, &buffer, children, start_location);
  location_free(start_location);
  buffer_free(&buffer);

  token_T* close_quote = parser_consume_expected(parser, TOKEN_QUOTE, errors);

  if (open_quote != NULL && close_quote != NULL && strcmp(open_quote->value, close_quote->value) != 0) {
    AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = ast_unexpected_token_node_init_from_raw_message(
      close_quote->start,
      close_quote->end,
      "Unexpected quote",
      open_quote->value,
      close_quote->value
    );

    array_append(errors, unexpected_token_node);
  }

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* attribute_value = ast_html_attribute_value_node_init(
    open_quote,
    children,
    close_quote,
    true,
    open_quote->start,
    close_quote->end,
    errors
  );

  token_free(open_quote);
  token_free(close_quote);

  return attribute_value;
}

static AST_HTML_ATTRIBUTE_VALUE_NODE_T* parser_parse_html_attribute_value(parser_T* parser) {
  array_T* children = array_init(8);
  array_T* errors = array_init(8);

  // <div id=<%= "home" %>>
  if (token_is(parser, TOKEN_ERB_START)) {
    AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
    array_append(children, erb_node);

    return ast_html_attribute_value_node_init(
      NULL,
      children,
      NULL,
      false,
      erb_node->base.start,
      erb_node->base.end,
      NULL
    );
  }

  // <div id=home>
  if (token_is(parser, TOKEN_IDENTIFIER)) {
    token_T* identifier = parser_consume_expected(parser, TOKEN_IDENTIFIER, errors);
    AST_LITERAL_NODE_T* literal = ast_literal_node_init_from_token(identifier);
    token_free(identifier);

    array_append(children, literal);

    return ast_html_attribute_value_node_init(
      NULL,
      children,
      NULL,
      false,
      literal->base.start,
      literal->base.end,
      NULL
    );
  }

  // <div id="home">
  if (token_is(parser, TOKEN_QUOTE)) { return parser_parse_quoted_html_attribute_value(parser, children, errors); }

  token_T* token = parser_advance(parser);
  AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node =
    ast_unexpected_token_node_init_from_token(token, "TOKEN_IDENTIFIER, TOKEN_QUOTE, TOKEN_ERB_START");
  token_free(token);

  array_append(errors, unexpected_token_node);

  return ast_html_attribute_value_node_init(
    NULL,
    children,
    NULL,
    false,
    unexpected_token_node->base.start,
    unexpected_token_node->base.end,
    errors
  );
}

static AST_HTML_ATTRIBUTE_NODE_T* parser_parse_html_attribute(parser_T* parser) {
  AST_HTML_ATTRIBUTE_NAME_NODE_T* attribute_name = parser_parse_html_attribute_name(parser);

  token_T* equals = parser_consume_if_present(parser, TOKEN_EQUALS);

  if (equals != NULL) {
    AST_HTML_ATTRIBUTE_VALUE_NODE_T* attribute_value = parser_parse_html_attribute_value(parser);

    AST_HTML_ATTRIBUTE_NODE_T* attribute_node = ast_html_attribute_node_init(
      attribute_name,
      equals,
      attribute_value,
      attribute_name->base.start,
      attribute_value->base.end,
      NULL
    );

    token_free(equals);

    return attribute_node;
  }

  return ast_html_attribute_node_init(
    attribute_name,
    NULL,
    NULL,
    attribute_name->base.start,
    attribute_name->base.end,
    NULL
  );
}

static AST_HTML_ELEMENT_NODE_T* parser_handle_missing_close_tag(
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

static void parser_handle_mismatched_tags(
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

static AST_HTML_OPEN_TAG_NODE_T* parser_parse_html_open_tag(parser_T* parser) {
  array_T* errors = array_init(8);
  array_T* children = array_init(8);
  array_T* attributes = array_init(8);

  token_T* tag_start = parser_consume_expected(parser, TOKEN_HTML_TAG_START, errors);
  token_T* tag_name = parser_consume_expected(parser, TOKEN_IDENTIFIER, errors);

  while (token_is_none_of(parser, TOKEN_HTML_TAG_END, TOKEN_HTML_TAG_SELF_CLOSE, TOKEN_EOF)) {
    token_T* whitespace = parser_consume_if_present(parser, TOKEN_WHITESPACE);

    if (whitespace != NULL) {
      token_free(whitespace);
      continue;
    }

    if (parser->current_token->type == TOKEN_ERB_START) {
      array_append(children, parser_parse_erb_tag(parser));
      continue;
    }

    if (parser->current_token->type == TOKEN_IDENTIFIER) {
      array_append(attributes, parser_parse_html_attribute(parser));
      continue;
    }

    token_T* token = parser_advance(parser);
    array_append(
      errors,
      ast_unexpected_token_node_init_from_token(token, "TOKEN_IDENTIFIER, TOKEN_ERB_START, or TOKEN_WHITESPACE")
    );
    token_free(token);
  }

  bool is_self_closing = false;

  token_T* tag_end = parser_consume_if_present(parser, TOKEN_HTML_TAG_END);

  if (tag_end == NULL) {
    tag_end = parser_consume_expected(parser, TOKEN_HTML_TAG_SELF_CLOSE, errors);

    if (tag_end == NULL) {
      token_free(tag_start);
      token_free(tag_name);

      return NULL;
    }

    is_self_closing = true;
  }

  AST_HTML_OPEN_TAG_NODE_T* open_tag_node = ast_html_open_tag_node_init(
    tag_start,
    tag_name,
    attributes,
    tag_end,
    children,
    is_self_closing,
    tag_start->start,
    tag_end->end,
    errors
  );

  token_free(tag_start);
  token_free(tag_name);
  token_free(tag_end);

  return open_tag_node;
}

static AST_HTML_CLOSE_TAG_NODE_T* parser_parse_html_close_tag(parser_T* parser) {
  array_T* errors = array_init(8);

  token_T* tag_opening = parser_consume_expected(parser, TOKEN_HTML_TAG_START_CLOSE, errors);
  token_T* tag_name = parser_consume_expected(parser, TOKEN_IDENTIFIER, errors);
  token_T* tag_closing = parser_consume_expected(parser, TOKEN_HTML_TAG_END, errors);

  if (tag_name != NULL && is_void_element(tag_name->value)) {
    char* expected = html_self_closing_tag_string(tag_name->value);
    char* actual = html_closing_tag_string(tag_name->value);

    AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = ast_unexpected_token_node_init_from_raw_message(
      tag_opening->start,
      tag_closing->end,
      "Void elements shouldn't be used as closing tags.",
      expected,
      actual
    );

    free(expected);
    free(actual);

    array_append(errors, unexpected_token_node);
  }

  AST_HTML_CLOSE_TAG_NODE_T* close_tag =
    ast_html_close_tag_node_init(tag_opening, tag_name, tag_closing, tag_opening->start, tag_closing->end, errors);

  token_free(tag_opening);
  token_free(tag_name);
  token_free(tag_closing);

  return close_tag;
}

// TODO: this should probably be AST_HTML_ELEMENT_NODE_T with a AST_HTML_SELF_CLOSING_TAG_NODE_T
static AST_HTML_ELEMENT_NODE_T* parser_parse_html_self_closing_element(
  parser_T* parser, AST_HTML_OPEN_TAG_NODE_T* open_tag
) {
  if (open_tag->base.type != AST_HTML_SELF_CLOSE_TAG_NODE) {
    if (!is_void_element(open_tag->tag_name->value)) { return NULL; }
  }

  return ast_html_element_node_init(
    open_tag,
    open_tag->tag_name,
    NULL,
    NULL,
    true,
    open_tag->base.start,
    open_tag->base.end,
    NULL
  );
}

static AST_HTML_ELEMENT_NODE_T* parser_parse_html_regular_element(
  parser_T* parser, AST_HTML_OPEN_TAG_NODE_T* open_tag
) {
  if (open_tag->base.type != AST_HTML_OPEN_TAG_NODE) { return NULL; }

  array_T* errors = array_init(8);
  array_T* body = array_init(8);

  parser_push_open_tag(parser, open_tag->tag_name);

  parser_parse_in_data_state(parser, body, errors);

  if (!token_is(parser, TOKEN_HTML_TAG_START_CLOSE)) { return parser_handle_missing_close_tag(open_tag, body, errors); }

  AST_HTML_CLOSE_TAG_NODE_T* close_tag = parser_parse_html_close_tag(parser);

  if (is_void_element(close_tag->tag_name->value)) {
    array_push(body, close_tag);
    parser_parse_in_data_state(parser, body, errors);
    close_tag = parser_parse_html_close_tag(parser);
  }

  bool matches_stack = parser_check_matching_tag(parser, close_tag->tag_name->value);

  if (matches_stack) {
    token_T* popped_token = parser_pop_open_tag(parser);
    token_free(popped_token);
  } else {
    parser_handle_mismatched_tags(parser, close_tag, errors);
  }

  return ast_html_element_node_init(
    open_tag,
    open_tag->tag_name,
    body,
    close_tag,
    false,
    open_tag->base.start,
    close_tag->base.end,
    errors
  );
}

static AST_HTML_ELEMENT_NODE_T* parser_parse_html_element(parser_T* parser) {
  AST_HTML_OPEN_TAG_NODE_T* open_tag = parser_parse_html_open_tag(parser);

  AST_HTML_ELEMENT_NODE_T* self_closing_element = parser_parse_html_self_closing_element(parser, open_tag);
  if (self_closing_element != NULL) { return self_closing_element; }

  AST_HTML_ELEMENT_NODE_T* regular_element = parser_parse_html_regular_element(parser, open_tag);
  if (regular_element != NULL) { return regular_element; }

  array_T* errors = array_init(1);

  AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = ast_unexpected_token_node_init_from_raw_message(
    open_tag->base.start,
    open_tag->base.end,
    "open_tag type",
    "AST_HTML_OPEN_TAG_NODE or AST_HTML_SELF_CLOSE_TAG_NODE",
    open_tag->tag_name->value
  );

  array_append(errors, unexpected_token_node);

  AST_HTML_ELEMENT_NODE_T* element_node = ast_html_element_node_init(
    open_tag,
    open_tag->tag_name,
    NULL,
    NULL,
    false,
    open_tag->base.start,
    open_tag->base.end,
    errors
  );

  return element_node;
}

static AST_ERB_CONTENT_NODE_T* parser_parse_erb_tag(parser_T* parser) {
  array_T* errors = array_init(8);

  token_T* opening_tag = parser_consume_expected(parser, TOKEN_ERB_START, errors);
  token_T* content = parser_consume_expected(parser, TOKEN_ERB_CONTENT, errors);
  token_T* closing_tag = parser_consume_expected(parser, TOKEN_ERB_END, errors);

  AST_ERB_CONTENT_NODE_T* erb_node =
    ast_erb_content_node_init(opening_tag, content, closing_tag, opening_tag->start, closing_tag->end, errors);

  token_free(opening_tag);
  token_free(content);
  token_free(closing_tag);

  return erb_node;
}

static void parser_parse_in_data_state(parser_T* parser, array_T* children, array_T* errors) {
  while (token_is_none_of(parser, TOKEN_HTML_TAG_START_CLOSE, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      array_append(children, parser_parse_erb_tag(parser));
      continue;
    }

    if (token_is(parser, TOKEN_HTML_DOCTYPE)) {
      array_append(children, parser_parse_html_doctype(parser));
      continue;
    }

    if (token_is(parser, TOKEN_HTML_COMMENT_START)) {
      array_append(children, parser_parse_html_comment(parser));
      continue;
    }

    if (token_is(parser, TOKEN_HTML_TAG_START)) {
      array_append(children, parser_parse_html_element(parser));
      continue;
    }

    if (token_is_any_of(parser, TOKEN_IDENTIFIER, TOKEN_WHITESPACE, TOKEN_NEWLINE)) {
      array_append(children, parser_parse_text_content(parser));
      continue;
    }

    AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = parser_init_unexpected_token(parser);

    if (unexpected_token_node != NULL) { array_append(errors, unexpected_token_node); }
  }
}

static void parser_parse_unclosed_html_tags(parser_T* parser, array_T* errors) {
  while (array_size(parser->open_tags_stack) > 0) {
    token_T* unclosed_token = parser_pop_open_tag(parser);

    char* closing_tag = html_closing_tag_string(unclosed_token->value);
    char error_message[256];

    snprintf(
      error_message,
      sizeof(error_message),
      "unclosed HTML tag at end of document (opened at %zu:%zu)",
      unclosed_token->start->line,
      unclosed_token->start->column
    );

    AST_UNEXPECTED_TOKEN_NODE_T* unclosed_error = ast_unexpected_token_node_init_from_raw_message(
      parser->current_token->start,
      parser->current_token->end,
      error_message,
      closing_tag,
      "EOF"
    );

    free(closing_tag);
    array_append(errors, unclosed_error);
    token_free(unclosed_token);
  }
}

static void parser_parse_stray_closing_tags(parser_T* parser, array_T* children, array_T* errors) {
  while (token_is_not(parser, TOKEN_EOF)) {
    if (token_is_not(parser, TOKEN_HTML_TAG_START_CLOSE)) {
      AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = parser_init_unexpected_token(parser);

      if (unexpected_token_node != NULL) { array_append(errors, unexpected_token_node); }

      continue;
    }

    AST_HTML_CLOSE_TAG_NODE_T* close_tag = parser_parse_html_close_tag(parser);

    if (!is_void_element(close_tag->tag_name->value)) {
      char* expected = html_opening_tag_string(close_tag->tag_name->value);

      // TODO: add `element was closed at (1:1)` to message
      AST_UNEXPECTED_TOKEN_NODE_T* missing_open_tag_error = ast_unexpected_token_node_init_from_raw_message(
        close_tag->base.start,
        close_tag->base.end,
        "expected element to have a start tag",
        expected,
        ""
      );

      free(expected);

      array_append(close_tag->base.errors, missing_open_tag_error);
    }

    array_append(children, close_tag);

    parser_parse_in_data_state(parser, children, errors);
  }
}

static AST_DOCUMENT_NODE_T* parser_parse_document(parser_T* parser) {
  array_T* children = array_init(8);
  array_T* errors = array_init(8);
  location_T* start_location = location_copy(parser->current_token->start);

  parser_parse_in_data_state(parser, children, errors);
  parser_parse_unclosed_html_tags(parser, errors);
  parser_parse_stray_closing_tags(parser, children, errors);

  token_T* eof = parser_consume_expected(parser, TOKEN_EOF, errors);

  AST_DOCUMENT_NODE_T* document_node = ast_document_node_init(children, start_location, eof->end, errors);

  location_free(start_location);
  token_free(eof);

  return document_node;
}

AST_DOCUMENT_NODE_T* parser_parse(parser_T* parser) {
  return parser_parse_document(parser);
}

void parser_free(parser_T* parser) {
  if (parser == NULL) { return; }

  if (parser->lexer != NULL) { lexer_free(parser->lexer); }
  if (parser->current_token != NULL) { token_free(parser->current_token); }
  if (parser->open_tags_stack != NULL) { array_free(&parser->open_tags_stack); }

  free(parser);
}
