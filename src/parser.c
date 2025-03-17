#include "include/parser.h"
#include "include/array.h"
#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/buffer.h"
#include "include/errors.h"
#include "include/html_util.h"
#include "include/lexer.h"
#include "include/parser_helpers.h"
#include "include/token.h"
#include "include/token_matchers.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

static void parser_parse_in_data_state(parser_T* parser, array_T* children, array_T* errors);
static AST_ERB_CONTENT_NODE_T* parser_parse_erb_tag(parser_T* parser);

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

static AST_HTML_COMMENT_NODE_T* parser_parse_html_comment(parser_T* parser) {
  array_T* errors = array_init(8);
  array_T* children = array_init(8);
  token_T* comment_start = parser_consume_expected(parser, TOKEN_HTML_COMMENT_START, errors);
  position_T* start = position_copy(parser->current_token->location->start);

  buffer_T comment = buffer_new();

  while (token_is_none_of(parser, TOKEN_HTML_COMMENT_END, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &comment, children, start);

      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      array_append(children, erb_node);

      position_free(start);
      start = position_copy(parser->current_token->location->start);

      continue;
    }

    token_T* token = parser_advance(parser);
    buffer_append(&comment, token->value);
    token_free(token);
  }

  parser_append_literal_node_from_buffer(parser, &comment, children, start);

  token_T* comment_end = parser_consume_expected(parser, TOKEN_HTML_COMMENT_END, errors);

  AST_HTML_COMMENT_NODE_T* comment_node = ast_html_comment_node_init(
    comment_start,
    children,
    comment_end,
    comment_start->location->start,
    comment_end->location->end,
    errors
  );

  buffer_free(&comment);
  position_free(start);
  token_free(comment_start);
  token_free(comment_end);

  return comment_node;
}

static AST_HTML_DOCTYPE_NODE_T* parser_parse_html_doctype(parser_T* parser) {
  array_T* errors = array_init(8);
  array_T* children = array_init(8);
  buffer_T content = buffer_new();

  token_T* tag_opening = parser_consume_expected(parser, TOKEN_HTML_DOCTYPE, errors);

  position_T* start = position_copy(parser->current_token->location->start);

  while (token_is_none_of(parser, TOKEN_HTML_TAG_END, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &content, children, start);

      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      array_append(children, erb_node);

      continue;
    }

    token_T* token = parser_consume_expected(parser, parser->current_token->type, errors);
    buffer_append(&content, token->value);
    token_free(token);
  }

  parser_append_literal_node_from_buffer(parser, &content, children, start);

  token_T* tag_closing = parser_consume_expected(parser, TOKEN_HTML_TAG_END, errors);

  AST_HTML_DOCTYPE_NODE_T* doctype = ast_html_doctype_node_init(
    tag_opening,
    children,
    tag_closing,
    tag_opening->location->start,
    tag_closing->location->end,
    errors
  );

  position_free(start);
  token_free(tag_opening);
  token_free(tag_closing);
  buffer_free(&content);

  return doctype;
}

static AST_HTML_TEXT_NODE_T* parser_parse_text_content(parser_T* parser) {
  position_T* start = position_copy(parser->current_token->location->start);

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
      append_unexpected_error(
        "Token Error",
        "not TOKEN_ERROR",
        token->value,
        token->location->start,
        token->location->end,
        errors
      );
      token_free(token);

      return NULL;
    }

    token_T* token = parser_advance(parser);
    buffer_append(&content, token->value);
    token_free(token);
  }

  if (buffer_length(&content) > 0) {
    AST_HTML_TEXT_NODE_T* text_node =
      ast_html_text_node_init(buffer_value(&content), start, parser->current_token->location->start, errors);

    position_free(start);
    buffer_free(&content);

    return text_node;
  }

  AST_HTML_TEXT_NODE_T* text_node = ast_html_text_node_init("", start, parser->current_token->location->start, errors);

  position_free(start);
  buffer_free(&content);

  return text_node;
}

static AST_HTML_ATTRIBUTE_NAME_NODE_T* parser_parse_html_attribute_name(parser_T* parser) {
  array_T* errors = array_init(8);
  token_T* identifier = parser_consume_if_present(parser, TOKEN_IDENTIFIER);

  if (identifier == NULL) { parser_append_unexpected_token_error(parser, TOKEN_IDENTIFIER, errors); }

  AST_HTML_ATTRIBUTE_NAME_NODE_T* attribute_name =
    ast_html_attribute_name_node_init(identifier, identifier->location->start, identifier->location->end, errors);

  token_free(identifier);

  return attribute_name;
}

static AST_HTML_ATTRIBUTE_VALUE_NODE_T* parser_parse_quoted_html_attribute_value(
  parser_T* parser, array_T* children, array_T* errors
) {
  buffer_T buffer = buffer_new();
  token_T* opening_quote = parser_consume_expected(parser, TOKEN_QUOTE, errors);
  position_T* start = position_copy(parser->current_token->location->start);

  while (token_is_none_of(parser, TOKEN_QUOTE, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &buffer, children, start);

      array_append(children, parser_parse_erb_tag(parser));

      position_free(start);
      start = position_copy(parser->current_token->location->start);

      continue;
    }

    buffer_append(&buffer, parser->current_token->value);
    token_free(parser->current_token);
    parser->current_token = lexer_next_token(parser->lexer);
  }

  parser_append_literal_node_from_buffer(parser, &buffer, children, start);
  position_free(start);
  buffer_free(&buffer);

  token_T* closing_quote = parser_consume_expected(parser, TOKEN_QUOTE, errors);

  if (opening_quote != NULL && closing_quote != NULL && strcmp(opening_quote->value, closing_quote->value) != 0) {
    append_quotes_mismatch_error(
      opening_quote,
      closing_quote,
      closing_quote->location->start,
      closing_quote->location->end,
      errors
    );
  }

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* attribute_value = ast_html_attribute_value_node_init(
    opening_quote,
    children,
    closing_quote,
    true,
    opening_quote->location->start,
    closing_quote->location->end,
    errors
  );

  token_free(opening_quote);
  token_free(closing_quote);

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
      erb_node->base.location->start,
      erb_node->base.location->end,
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
      literal->base.location->start,
      literal->base.location->end,
      NULL
    );
  }

  // <div id="home">
  if (token_is(parser, TOKEN_QUOTE)) { return parser_parse_quoted_html_attribute_value(parser, children, errors); }

  token_T* token = parser_advance(parser);

  append_unexpected_error(
    "Unexpected Token",
    "TOKEN_IDENTIFIER, TOKEN_QUOTE, TOKEN_ERB_START",
    token_type_to_string(token->type),
    token->location->start,
    token->location->end,
    errors
  );

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value = ast_html_attribute_value_node_init(
    NULL,
    children,
    NULL,
    false,
    token->location->start,
    token->location->end,
    errors
  );

  token_free(token);

  return value;
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
      attribute_name->base.location->start,
      attribute_value->base.location->end,
      NULL
    );

    token_free(equals);

    return attribute_node;
  }

  return ast_html_attribute_node_init(
    attribute_name,
    NULL,
    NULL,
    attribute_name->base.location->start,
    attribute_name->base.location->end,
    NULL
  );
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

    token_T* newline = parser_consume_if_present(parser, TOKEN_NEWLINE);

    if (newline != NULL) {
      token_free(newline);
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

    parser_append_unexpected_error(
      parser,
      "Unexpected Token",
      "TOKEN_IDENTIFIER, TOKEN_ERB_START,TOKEN_WHITESPACE, or TOKEN_NEWLINE",
      errors
    );
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
    tag_start->location->start,
    tag_end->location->end,
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

  if (tag_name != NULL && is_void_element(tag_name->value) && parser_in_svg_context(parser) == false) {
    char* expected = html_self_closing_tag_string(tag_name->value);
    char* got = html_closing_tag_string(tag_name->value);

    append_void_element_closing_tag_error(
      tag_name,
      expected,
      got,
      tag_opening->location->start,
      tag_closing->location->end,
      errors
    );

    free(expected);
    free(got);
  }

  AST_HTML_CLOSE_TAG_NODE_T* close_tag = ast_html_close_tag_node_init(
    tag_opening,
    tag_name,
    tag_closing,
    tag_opening->location->start,
    tag_closing->location->end,
    errors
  );

  token_free(tag_opening);
  token_free(tag_name);
  token_free(tag_closing);

  return close_tag;
}

// TODO: this should probably be AST_HTML_ELEMENT_NODE_T with a AST_HTML_SELF_CLOSING_TAG_NODE_T
static AST_HTML_ELEMENT_NODE_T* parser_parse_html_self_closing_element(
  const parser_T* parser, AST_HTML_OPEN_TAG_NODE_T* open_tag
) {
  return ast_html_element_node_init(
    open_tag,
    open_tag->tag_name,
    NULL,
    NULL,
    true,
    open_tag->base.location->start,
    open_tag->base.location->end,
    NULL
  );
}

static AST_HTML_ELEMENT_NODE_T* parser_parse_html_regular_element(
  parser_T* parser, AST_HTML_OPEN_TAG_NODE_T* open_tag
) {
  array_T* errors = array_init(8);
  array_T* body = array_init(8);

  parser_push_open_tag(parser, open_tag->tag_name);

  parser_parse_in_data_state(parser, body, errors);

  if (!token_is(parser, TOKEN_HTML_TAG_START_CLOSE)) { return parser_handle_missing_close_tag(open_tag, body, errors); }

  AST_HTML_CLOSE_TAG_NODE_T* close_tag = parser_parse_html_close_tag(parser);

  if (parser_in_svg_context(parser) == false && is_void_element(close_tag->tag_name->value)) {
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
    open_tag->base.location->start,
    close_tag->base.location->end,
    errors
  );
}

static AST_HTML_ELEMENT_NODE_T* parser_parse_html_element(parser_T* parser) {
  AST_HTML_OPEN_TAG_NODE_T* open_tag = parser_parse_html_open_tag(parser);

  // <tag />
  if (open_tag->is_void || ast_node_is((AST_NODE_T*) open_tag, AST_HTML_SELF_CLOSE_TAG_NODE)) {
    return parser_parse_html_self_closing_element(parser, open_tag);
  }

  // <tag>, in void element list, and not in inside an <svg> element
  if (!open_tag->is_void && is_void_element(open_tag->tag_name->value) && !parser_in_svg_context(parser)) {
    return parser_parse_html_self_closing_element(parser, open_tag);
  }

  AST_HTML_ELEMENT_NODE_T* regular_element = parser_parse_html_regular_element(parser, open_tag);
  if (regular_element != NULL) { return regular_element; }

  array_T* errors = array_init(8);

  parser_append_unexpected_error(parser, "Unknown HTML open tag type", "HTMLOpenTag or HTMLSelfCloseTag", errors);

  return ast_html_element_node_init(
    open_tag,
    open_tag->tag_name,
    NULL,
    NULL,
    false,
    open_tag->base.location->start,
    open_tag->base.location->end,
    errors
  );
}

static AST_ERB_CONTENT_NODE_T* parser_parse_erb_tag(parser_T* parser) {
  array_T* errors = array_init(8);

  token_T* opening_tag = parser_consume_expected(parser, TOKEN_ERB_START, errors);
  token_T* content = parser_consume_expected(parser, TOKEN_ERB_CONTENT, errors);
  token_T* closing_tag = parser_consume_expected(parser, TOKEN_ERB_END, errors);

  AST_ERB_CONTENT_NODE_T* erb_node = ast_erb_content_node_init(
    opening_tag,
    content,
    closing_tag,
    opening_tag->location->start,
    closing_tag->location->end,
    errors
  );

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

    parser_append_unexpected_error(
      parser,
      "Unexpected token",
      "TOKEN_ERB_START, TOKEN_HTML_DOCTYPE, TOKEN_HTML_COMMENT_START, TOKEN_IDENTIFIER, TOKEN_WHITESPACE, or "
      "TOKEN_NEWLINE",
      errors
    );
  }
}

static void parser_parse_unclosed_html_tags(const parser_T* parser, array_T* errors) {
  while (array_size(parser->open_tags_stack) > 0) {
    token_T* unclosed_tag = parser_pop_open_tag(parser);

    append_unclosed_element_error(
      unclosed_tag,
      parser->current_token->location->start,
      parser->current_token->location->end,
      errors
    );

    token_free(unclosed_tag);
  }
}

static void parser_parse_stray_closing_tags(parser_T* parser, array_T* children, array_T* errors) {
  while (token_is_not(parser, TOKEN_EOF)) {
    if (token_is_not(parser, TOKEN_HTML_TAG_START_CLOSE)) {
      parser_append_unexpected_token_error(parser, TOKEN_HTML_TAG_START_CLOSE, errors);
      continue;
    }

    AST_HTML_CLOSE_TAG_NODE_T* close_tag = parser_parse_html_close_tag(parser);

    if (!is_void_element(close_tag->tag_name->value)) {
      append_missing_opening_tag_error(
        close_tag->tag_name,
        close_tag->base.location->start,
        close_tag->base.location->end,
        close_tag->base.errors
      );
    }

    array_append(children, close_tag);

    parser_parse_in_data_state(parser, children, errors);
  }
}

static AST_DOCUMENT_NODE_T* parser_parse_document(parser_T* parser) {
  array_T* children = array_init(8);
  array_T* errors = array_init(8);
  position_T* start = position_copy(parser->current_token->location->start);

  parser_parse_in_data_state(parser, children, errors);
  parser_parse_unclosed_html_tags(parser, errors);
  parser_parse_stray_closing_tags(parser, children, errors);

  token_T* eof = parser_consume_expected(parser, TOKEN_EOF, errors);

  AST_DOCUMENT_NODE_T* document_node = ast_document_node_init(children, start, eof->location->end, errors);

  position_free(start);
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
