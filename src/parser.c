#include "include/parser.h"
#include "include/array.h"
#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/buffer.h"
#include "include/errors.h"
#include "include/html_util.h"
#include "include/lexer.h"
#include "include/lexer_peek_helpers.h"
#include "include/parser_helpers.h"
#include "include/token.h"
#include "include/token_matchers.h"
#include "include/util.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

static void parser_parse_in_data_state(parser_T* parser, array_T* children, array_T* errors);
static void parser_parse_foreign_content(parser_T* parser, array_T* children, array_T* errors);
static AST_ERB_CONTENT_NODE_T* parser_parse_erb_tag(parser_T* parser);
static void parser_handle_whitespace(parser_T* parser, token_T* whitespace_token, array_T* children);
static void parser_consume_whitespace(parser_T* parser, array_T* children);
static void parser_skip_erb_content(lexer_T* lexer);
static bool parser_lookahead_erb_is_attribute(lexer_T* lexer);
static void parser_handle_erb_in_open_tag(parser_T* parser, array_T* children);
static void parser_handle_whitespace_in_open_tag(parser_T* parser, array_T* children);

size_t parser_sizeof(void) {
  return sizeof(struct PARSER_STRUCT);
}

parser_T* parser_init(lexer_T* lexer, parser_options_T* options) {
  parser_T* parser = calloc(1, parser_sizeof());

  parser->lexer = lexer;
  parser->current_token = lexer_next_token(lexer);
  parser->open_tags_stack = array_init(16);
  parser->state = PARSER_STATE_DATA;
  parser->foreign_content_type = FOREIGN_CONTENT_UNKNOWN;

  if (options) {
    parser->options = calloc(1, sizeof(parser_options_T));
    parser->options->track_whitespace = options->track_whitespace;
  } else {
    parser->options = NULL;
  }

  return parser;
}

static AST_CDATA_NODE_T* parser_parse_cdata(parser_T* parser) {
  array_T* errors = array_init(8);
  array_T* children = array_init(8);
  buffer_T content = buffer_new();

  token_T* tag_opening = parser_consume_expected(parser, TOKEN_CDATA_START, errors);
  position_T* start = position_copy(parser->current_token->location->start);

  while (token_is_none_of(parser, TOKEN_CDATA_END, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &content, children, start);
      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      array_append(children, erb_node);
      position_free(start);
      start = position_copy(parser->current_token->location->start);
      continue;
    }

    token_T* token = parser_advance(parser);
    buffer_append(&content, token->value);
    token_free(token);
  }

  parser_append_literal_node_from_buffer(parser, &content, children, start);
  token_T* tag_closing = parser_consume_expected(parser, TOKEN_CDATA_END, errors);

  AST_CDATA_NODE_T* cdata = ast_cdata_node_init(
    tag_opening,
    children,
    tag_closing,
    tag_opening->location->start,
    tag_closing->location->end,
    errors
  );

  position_free(start);
  buffer_free(&content);
  token_free(tag_opening);
  token_free(tag_closing);

  return cdata;
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

static AST_XML_DECLARATION_NODE_T* parser_parse_xml_declaration(parser_T* parser) {
  array_T* errors = array_init(8);
  array_T* children = array_init(8);
  buffer_T content = buffer_new();

  token_T* tag_opening = parser_consume_expected(parser, TOKEN_XML_DECLARATION, errors);

  position_T* start = position_copy(parser->current_token->location->start);

  while (token_is_none_of(parser, TOKEN_XML_DECLARATION_END, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &content, children, start);

      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      array_append(children, erb_node);

      position_free(start);
      start = position_copy(parser->current_token->location->start);

      continue;
    }

    token_T* token = parser_advance(parser);
    buffer_append(&content, token->value);
    token_free(token);
  }

  parser_append_literal_node_from_buffer(parser, &content, children, start);

  token_T* tag_closing = parser_consume_expected(parser, TOKEN_XML_DECLARATION_END, errors);

  AST_XML_DECLARATION_NODE_T* xml_declaration = ast_xml_declaration_node_init(
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

  return xml_declaration;
}

static AST_HTML_TEXT_NODE_T* parser_parse_text_content(parser_T* parser, array_T* document_errors) {
  position_T* start = position_copy(parser->current_token->location->start);

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

      token_T* token = parser_consume_expected(parser, TOKEN_ERROR, document_errors);
      append_unexpected_error(
        "Token Error",
        "not TOKEN_ERROR",
        token->value,
        token->location->start,
        token->location->end,
        document_errors
      );

      token_free(token);
      position_free(start);

      return NULL;
    }

    token_T* token = parser_advance(parser);
    buffer_append(&content, token->value);
    token_free(token);
  }

  array_T* errors = array_init(8);

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
  array_T* children = array_init(8);
  buffer_T buffer = buffer_new();
  position_T* start = position_copy(parser->current_token->location->start);

  while (token_is_none_of(
    parser,
    TOKEN_EQUALS,
    TOKEN_WHITESPACE,
    TOKEN_NEWLINE,
    TOKEN_HTML_TAG_END,
    TOKEN_HTML_TAG_SELF_CLOSE,
    TOKEN_EOF
  )) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &buffer, children, start);

      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      array_append(children, erb_node);

      position_free(start);
      start = position_copy(parser->current_token->location->start);
      continue;
    }

    token_T* token = parser_advance(parser);
    buffer_append(&buffer, token->value);
    token_free(token);
  }

  parser_append_literal_node_from_buffer(parser, &buffer, children, start);

  position_T* node_start = NULL;
  position_T* node_end = NULL;

  if (children->size > 0) {
    AST_NODE_T* first_child = array_get(children, 0);
    AST_NODE_T* last_child = array_get(children, children->size - 1);

    node_start = position_copy(first_child->location->start);
    node_end = position_copy(last_child->location->end);
  } else {
    node_start = position_copy(parser->current_token->location->start);
    node_end = position_copy(parser->current_token->location->start);
  }

  AST_HTML_ATTRIBUTE_NAME_NODE_T* attribute_name =
    ast_html_attribute_name_node_init(children, node_start, node_end, errors);

  position_free(start);
  position_free(node_start);
  position_free(node_end);
  buffer_free(&buffer);

  return attribute_name;
}

static AST_HTML_ATTRIBUTE_VALUE_NODE_T* parser_parse_quoted_html_attribute_value(
  parser_T* parser,
  array_T* children,
  array_T* errors
) {
  buffer_T buffer = buffer_new();
  token_T* opening_quote = parser_consume_expected(parser, TOKEN_QUOTE, errors);
  position_T* start = position_copy(parser->current_token->location->start);

  while (!token_is(parser, TOKEN_EOF)
         && !(
           token_is(parser, TOKEN_QUOTE) && opening_quote != NULL
           && strcmp(parser->current_token->value, opening_quote->value) == 0
         )) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &buffer, children, start);

      array_append(children, parser_parse_erb_tag(parser));

      position_free(start);
      start = position_copy(parser->current_token->location->start);

      continue;
    }

    if (token_is(parser, TOKEN_BACKSLASH)) {
      lexer_state_snapshot_T saved_state = lexer_save_state(parser->lexer);

      token_T* next_token = lexer_next_token(parser->lexer);

      if (next_token && next_token->type == TOKEN_QUOTE && opening_quote != NULL
          && strcmp(next_token->value, opening_quote->value) == 0) {
        buffer_append(&buffer, parser->current_token->value);
        buffer_append(&buffer, next_token->value);

        token_free(parser->current_token);
        token_free(next_token);

        parser->current_token = lexer_next_token(parser->lexer);
        continue;
      } else {
        lexer_restore_state(parser->lexer, saved_state);

        if (next_token) { token_free(next_token); }
      }
    }

    buffer_append(&buffer, parser->current_token->value);
    token_free(parser->current_token);

    parser->current_token = lexer_next_token(parser->lexer);
  }

  if (token_is(parser, TOKEN_QUOTE) && opening_quote != NULL
      && strcmp(parser->current_token->value, opening_quote->value) == 0) {
    lexer_state_snapshot_T saved_state = lexer_save_state(parser->lexer);

    token_T* potential_closing = parser->current_token;
    parser->current_token = lexer_next_token(parser->lexer);

    if (token_is(parser, TOKEN_IDENTIFIER) || token_is(parser, TOKEN_CHARACTER)) {
      append_unexpected_error(
        "Unescaped quote character in attribute value",
        "escaped quote (\\') or different quote style (\")",
        opening_quote->value,
        potential_closing->location->start,
        potential_closing->location->end,
        errors
      );

      lexer_restore_state(parser->lexer, saved_state);

      token_free(parser->current_token);
      parser->current_token = potential_closing;

      buffer_append(&buffer, parser->current_token->value);
      token_free(parser->current_token);
      parser->current_token = lexer_next_token(parser->lexer);

      while (!token_is(parser, TOKEN_EOF)
             && !(
               token_is(parser, TOKEN_QUOTE) && opening_quote != NULL
               && strcmp(parser->current_token->value, opening_quote->value) == 0
             )) {
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
    } else {
      token_free(parser->current_token);
      parser->current_token = potential_closing;

      lexer_restore_state(parser->lexer, saved_state);
    }
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
      errors
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
      errors
    );
  }

  // <div id="home">
  if (token_is(parser, TOKEN_QUOTE)) { return parser_parse_quoted_html_attribute_value(parser, children, errors); }

  if (token_is(parser, TOKEN_BACKTICK)) {
    token_T* token = parser_advance(parser);
    position_T* start = position_copy(token->location->start);
    position_T* end = position_copy(token->location->end);

    append_unexpected_error(
      "Invalid quote character for HTML attribute",
      "single quote (') or double quote (\")",
      "backtick (`)",
      start,
      end,
      errors
    );

    AST_HTML_ATTRIBUTE_VALUE_NODE_T* value =
      ast_html_attribute_value_node_init(NULL, children, NULL, false, start, end, errors);

    position_free(start);
    position_free(end);
    token_free(token);

    return value;
  }

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

  if (parser->options && parser->options->track_whitespace) {
    bool has_equals = (parser->current_token->type == TOKEN_EQUALS)
                   || lexer_peek_for_token_type_after_whitespace(parser->lexer, TOKEN_EQUALS);

    if (has_equals) {
      buffer_T equals_buffer = buffer_new();
      position_T* equals_start = NULL;
      position_T* equals_end = NULL;
      size_t range_start = 0;
      size_t range_end = 0;

      while (token_is_any_of(parser, TOKEN_WHITESPACE, TOKEN_NEWLINE)) {
        token_T* whitespace = parser_advance(parser);

        if (equals_start == NULL) {
          equals_start = position_copy(whitespace->location->start);
          range_start = whitespace->range->from;
        }

        buffer_append(&equals_buffer, whitespace->value);
        token_free(whitespace);
      }

      token_T* equals = parser_advance(parser);

      if (equals_start == NULL) {
        equals_start = position_copy(equals->location->start);
        range_start = equals->range->from;
      }

      buffer_append(&equals_buffer, equals->value);
      equals_end = position_copy(equals->location->end);
      range_end = equals->range->to;
      token_free(equals);

      while (token_is_any_of(parser, TOKEN_WHITESPACE, TOKEN_NEWLINE)) {
        token_T* whitespace = parser_advance(parser);
        buffer_append(&equals_buffer, whitespace->value);
        equals_end = position_copy(whitespace->location->end);
        range_end = whitespace->range->to;
        token_free(whitespace);
      }

      token_T* equals_with_whitespace = calloc(1, sizeof(token_T));
      equals_with_whitespace->type = TOKEN_EQUALS;
      equals_with_whitespace->value = herb_strdup(equals_buffer.value);
      equals_with_whitespace->location = location_init(equals_start, equals_end);
      equals_with_whitespace->range = range_init(range_start, range_end);

      buffer_free(&equals_buffer);

      AST_HTML_ATTRIBUTE_VALUE_NODE_T* attribute_value = parser_parse_html_attribute_value(parser);

      return ast_html_attribute_node_init(
        attribute_name,
        equals_with_whitespace,
        attribute_value,
        attribute_name->base.location->start,
        attribute_value->base.location->end,
        NULL
      );
    } else {
      return ast_html_attribute_node_init(
        attribute_name,
        NULL,
        NULL,
        attribute_name->base.location->start,
        attribute_name->base.location->end,
        NULL
      );
    }
  } else {
    parser_consume_whitespace(parser, NULL);
  }

  token_T* equals = parser_consume_if_present(parser, TOKEN_EQUALS);

  if (equals != NULL) {
    parser_consume_whitespace(parser, NULL);

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

static void parser_skip_erb_content(lexer_T* lexer) {
  token_T* token = NULL;

  do {
    token = lexer_next_token(lexer);

    if (token->type == TOKEN_ERB_END) {
      token_free(token);
      break;
    }

    token_free(token);
  } while (true);
}

static bool parser_lookahead_erb_is_attribute(lexer_T* lexer) {
  token_T* after = NULL;

  do {
    after = lexer_next_token(lexer);

    if (after->type == TOKEN_EQUALS) {
      token_free(after);
      return true;
    }

    if (after->type == TOKEN_WHITESPACE || after->type == TOKEN_NEWLINE) {
      token_free(after);
      continue;
    }

    if (after->type == TOKEN_IDENTIFIER || after->type == TOKEN_CHARACTER || after->type == TOKEN_DASH
        || after->type == TOKEN_ERB_START) {

      if (after->type == TOKEN_ERB_START) {
        token_free(after);
        parser_skip_erb_content(lexer);
      } else {
        token_free(after);
      }
      continue;
    }

    token_free(after);
    return false;

  } while (true);
}

static void parser_handle_erb_in_open_tag(parser_T* parser, array_T* children) {
  bool is_output_tag = parser->current_token->value && strlen(parser->current_token->value) >= 3
                    && strncmp(parser->current_token->value, "<%=", 3) == 0;

  if (!is_output_tag) {
    array_append(children, parser_parse_erb_tag(parser));

    return;
  }

  lexer_T lexer_copy = *parser->lexer;

  token_T* erb_start = lexer_next_token(&lexer_copy);
  token_free(erb_start);
  parser_skip_erb_content(&lexer_copy);

  bool looks_like_attribute = parser_lookahead_erb_is_attribute(&lexer_copy);

  if (looks_like_attribute) {
    array_append(children, parser_parse_html_attribute(parser));
  } else {
    array_append(children, parser_parse_erb_tag(parser));
  }
}

static void parser_handle_whitespace_in_open_tag(parser_T* parser, array_T* children) {
  token_T* whitespace = parser_consume_if_present(parser, TOKEN_WHITESPACE);

  if (whitespace != NULL) {
    parser_handle_whitespace(parser, whitespace, children);
    return;
  }

  token_T* newline = parser_consume_if_present(parser, TOKEN_NEWLINE);

  if (newline != NULL) { parser_handle_whitespace(parser, newline, children); }
}

static AST_HTML_OPEN_TAG_NODE_T* parser_parse_html_open_tag(parser_T* parser) {
  array_T* errors = array_init(8);
  array_T* children = array_init(8);

  token_T* tag_start = parser_consume_expected(parser, TOKEN_HTML_TAG_START, errors);
  token_T* tag_name = parser_consume_expected(parser, TOKEN_IDENTIFIER, errors);

  while (token_is_none_of(parser, TOKEN_HTML_TAG_END, TOKEN_HTML_TAG_SELF_CLOSE, TOKEN_EOF)) {
    if (token_is_any_of(parser, TOKEN_WHITESPACE, TOKEN_NEWLINE)) {
      parser_handle_whitespace_in_open_tag(parser, children);
      continue;
    }

    if (parser->current_token->type == TOKEN_IDENTIFIER) {
      array_append(children, parser_parse_html_attribute(parser));
      continue;
    }

    if (parser->current_token->type == TOKEN_ERB_START) {
      parser_handle_erb_in_open_tag(parser, children);
      continue;
    }

    if (parser->current_token->type == TOKEN_AT) {
      array_append(children, parser_parse_html_attribute(parser));
      continue;
    }

    parser_append_unexpected_error(
      parser,
      "Unexpected Token",
      "TOKEN_IDENTIFIER, TOKEN_AT, TOKEN_ERB_START,TOKEN_WHITESPACE, or TOKEN_NEWLINE",
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

      array_free(&children);
      array_free(&errors);

      return NULL;
    }

    is_self_closing = true;
  }

  AST_HTML_OPEN_TAG_NODE_T* open_tag_node = ast_html_open_tag_node_init(
    tag_start,
    tag_name,
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
  array_T* children = array_init(8);

  token_T* tag_opening = parser_consume_expected(parser, TOKEN_HTML_TAG_START_CLOSE, errors);

  parser_consume_whitespace(parser, children);

  token_T* tag_name = parser_consume_expected(parser, TOKEN_IDENTIFIER, errors);

  parser_consume_whitespace(parser, children);

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
    children,
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
  const parser_T* parser,
  AST_HTML_OPEN_TAG_NODE_T* open_tag
) {
  return ast_html_element_node_init(
    open_tag,
    open_tag->tag_name,
    NULL,
    NULL,
    true,
    ELEMENT_SOURCE_HTML,
    open_tag->base.location->start,
    open_tag->base.location->end,
    NULL
  );
}

static AST_HTML_ELEMENT_NODE_T* parser_parse_html_regular_element(
  parser_T* parser,
  AST_HTML_OPEN_TAG_NODE_T* open_tag
) {
  array_T* errors = array_init(8);
  array_T* body = array_init(8);

  parser_push_open_tag(parser, open_tag->tag_name);

  if (open_tag->tag_name->value && parser_is_foreign_content_tag(open_tag->tag_name->value)) {
    foreign_content_type_T content_type = parser_get_foreign_content_type(open_tag->tag_name->value);
    parser_enter_foreign_content(parser, content_type);
    parser_parse_foreign_content(parser, body, errors);
  } else {
    parser_parse_in_data_state(parser, body, errors);
  }

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
    ELEMENT_SOURCE_HTML,
    open_tag->base.location->start,
    close_tag->base.location->end,
    errors
  );
}

static AST_HTML_ELEMENT_NODE_T* parser_parse_html_element(parser_T* parser) {
  AST_HTML_OPEN_TAG_NODE_T* open_tag = parser_parse_html_open_tag(parser);

  // <tag />
  if (open_tag->is_void) { return parser_parse_html_self_closing_element(parser, open_tag); }

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
    ELEMENT_SOURCE_HTML,
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
    NULL,
    false,
    false,
    opening_tag->location->start,
    closing_tag->location->end,
    errors
  );

  token_free(opening_tag);
  token_free(content);
  token_free(closing_tag);

  return erb_node;
}

static void parser_parse_foreign_content(parser_T* parser, array_T* children, array_T* errors) {
  buffer_T content = buffer_new();
  position_T* start = position_copy(parser->current_token->location->start);
  const char* expected_closing_tag = parser_get_foreign_content_closing_tag(parser->foreign_content_type);

  if (expected_closing_tag == NULL) {
    parser_exit_foreign_content(parser);
    position_free(start);
    buffer_free(&content);

    return;
  }

  while (!token_is(parser, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &content, children, start);

      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      array_append(children, erb_node);

      position_free(start);
      start = position_copy(parser->current_token->location->start);

      continue;
    }

    if (token_is(parser, TOKEN_HTML_TAG_START_CLOSE)) {
      lexer_state_snapshot_T saved_state = lexer_save_state(parser->lexer);

      token_T* next_token = lexer_next_token(parser->lexer);
      bool is_potential_match = false;

      if (next_token && next_token->type == TOKEN_IDENTIFIER && next_token->value) {
        is_potential_match = parser_is_expected_closing_tag_name(next_token->value, parser->foreign_content_type);
      }

      lexer_restore_state(parser->lexer, saved_state);

      if (next_token) { token_free(next_token); }

      if (is_potential_match) {
        parser_append_literal_node_from_buffer(parser, &content, children, start);
        parser_exit_foreign_content(parser);

        position_free(start);
        buffer_free(&content);

        return;
      }
    }

    token_T* token = parser_advance(parser);
    buffer_append(&content, token->value);
    token_free(token);
  }

  parser_append_literal_node_from_buffer(parser, &content, children, start);
  parser_exit_foreign_content(parser);
  position_free(start);
  buffer_free(&content);
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

    if (token_is(parser, TOKEN_XML_DECLARATION)) {
      array_append(children, parser_parse_xml_declaration(parser));
      continue;
    }

    if (token_is(parser, TOKEN_CDATA_START)) {
      array_append(children, parser_parse_cdata(parser));
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

    if (token_is_any_of(
          parser,
          TOKEN_AMPERSAND,
          TOKEN_AT,
          TOKEN_CHARACTER,
          TOKEN_COLON,
          TOKEN_DASH,
          TOKEN_EQUALS,
          TOKEN_EXCLAMATION,
          TOKEN_IDENTIFIER,
          TOKEN_NBSP,
          TOKEN_NEWLINE,
          TOKEN_PERCENT,
          TOKEN_QUOTE,
          TOKEN_SEMICOLON,
          TOKEN_SLASH,
          TOKEN_UNDERSCORE,
          TOKEN_WHITESPACE
        )) {
      array_append(children, parser_parse_text_content(parser, errors));
      continue;
    }

    parser_append_unexpected_error(
      parser,
      "Unexpected token",
      "TOKEN_ERB_START, TOKEN_HTML_DOCTYPE, TOKEN_HTML_COMMENT_START, TOKEN_IDENTIFIER, TOKEN_WHITESPACE, "
      "TOKEN_NBSP, TOKEN_AT, or TOKEN_NEWLINE",
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

      token_T* unexpected = parser_advance(parser);
      token_free(unexpected);

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

static void parser_handle_whitespace(parser_T* parser, token_T* whitespace_token, array_T* children) {
  if (parser->options && parser->options->track_whitespace) {
    array_T* errors = array_init(8);
    AST_WHITESPACE_NODE_T* whitespace_node = ast_whitespace_node_init(
      whitespace_token,
      whitespace_token->location->start,
      whitespace_token->location->end,
      errors
    );
    array_append(children, whitespace_node);
  }

  token_free(whitespace_token);
}

static void parser_consume_whitespace(parser_T* parser, array_T* children) {
  while (token_is_any_of(parser, TOKEN_WHITESPACE, TOKEN_NEWLINE)) {
    token_T* whitespace = parser_advance(parser);

    if (parser->options && parser->options->track_whitespace && children != NULL) {
      parser_handle_whitespace(parser, whitespace, children);
    } else {
      token_free(whitespace);
    }
  }
}

void parser_free(parser_T* parser) {
  if (parser == NULL) { return; }

  if (parser->lexer != NULL) { lexer_free(parser->lexer); }
  if (parser->current_token != NULL) { token_free(parser->current_token); }
  if (parser->open_tags_stack != NULL) { array_free(&parser->open_tags_stack); }
  if (parser->options != NULL) { free(parser->options); }

  free(parser);
}
