#include "include/parser.h"
#include "include/array.h"
#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/ast_pretty_print.h"
#include "include/buffer.h"
#include "include/html_util.h"
#include "include/lexer.h"
#include "include/token.h"
#include "include/util.h"

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

  return parser;
}

static AST_UNEXPECTED_TOKEN_NODE_T* parser_init_unexpected_token_from_current_token(
  parser_T* parser, const token_type_T expected_type
) {
  token_T* token = parser_advance(parser);

  AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token = ast_unexpected_token_node_init_from_raw_message(
    token->start,
    token->end,
    token->value,
    (char*) token_type_to_string(token->type),
    (char*) token_type_to_string(expected_type)
  );

  token_free(token);

  return unexpected_token;
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
  array_T* errors = array_init(1);
  array_T* children = array_init(8);
  token_T* comment_start = parser_consume_expected(parser, TOKEN_HTML_COMMENT_START, errors);
  location_T* start_location = location_copy(parser->current_token->start);

  buffer_T comment = buffer_new();

  while (parser->current_token->type != TOKEN_EOF && parser->current_token->type != TOKEN_HTML_COMMENT_END) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START: {
        if (buffer_length(&comment) > 0) {
          AST_LITERAL_NODE_T* literal =
            ast_literal_node_init(buffer_value(&comment), start_location, parser->current_token->start, NULL);
          array_append(children, literal);
          buffer_clear(&comment);
        }

        AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
        array_append(children, erb_node);

        location_free(start_location);
        start_location = location_copy(parser->current_token->start);

        break;
      }

      default: {
        token_T* token = parser_consume_expected(parser, parser->current_token->type, errors);
        buffer_append(&comment, token->value);
        token_free(token);
      }
    }
  }

  if (buffer_length(&comment) > 0) {
    AST_LITERAL_NODE_T* literal =
      ast_literal_node_init(buffer_value(&comment), start_location, parser->current_token->start, NULL);
    array_append(children, literal);
  }

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
  array_T* errors = array_init(1);
  array_T* children = array_init(8);
  buffer_T content = buffer_new();

  token_T* tag_opening = parser_consume_expected(parser, TOKEN_HTML_DOCTYPE, errors);

  location_T* start_location = location_copy(parser->current_token->start);

  while (parser->current_token->type != TOKEN_EOF && parser->current_token->type != TOKEN_HTML_TAG_END) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START: {
        if (buffer_length(&content) > 0) {
          array_append(
            children,
            ast_literal_node_init(buffer_value(&content), start_location, parser->current_token->start, NULL)
          );
          buffer_clear(&content);
        }

        AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
        array_append(children, erb_node);
      } break;

      case TOKEN_HTML_TAG_END:
      case TOKEN_EOF: {
        break;
      }

      default: {
        token_T* token = parser_consume_expected(parser, parser->current_token->type, errors);
        buffer_append(&content, token->value);
        token_free(token);
      }
    }
  }

  if (buffer_length(&content) > 0) {
    AST_LITERAL_NODE_T* literal =
      ast_literal_node_init(buffer_value(&content), start_location, parser->current_token->start, NULL);
    array_append(children, literal);
  }

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

  array_T* errors = array_init(1);
  buffer_T content = buffer_new();

  while (parser->current_token->type != TOKEN_EOF && parser->current_token->type != TOKEN_HTML_TAG_START
         && parser->current_token->type != TOKEN_HTML_TAG_START_CLOSE
         && parser->current_token->type != TOKEN_HTML_DOCTYPE && parser->current_token->type != TOKEN_HTML_COMMENT_START
         && parser->current_token->type != TOKEN_ERB_START) {
    switch (parser->current_token->type) {
      case TOKEN_EOF:
      case TOKEN_HTML_TAG_START:
      case TOKEN_HTML_TAG_START_CLOSE:
      case TOKEN_HTML_DOCTYPE:
      case TOKEN_HTML_COMMENT_START:
      case TOKEN_ERB_START: {
        break;
      }

      case TOKEN_ERROR: {
        buffer_free(&content);

        token_T* token = parser_consume_expected(parser, TOKEN_ERROR, errors);
        AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node =
          ast_unexpected_token_node_init_from_token(token, "not TOKEN_ERROR");
        token_free(token);

        array_append(errors, unexpected_token_node);

        return NULL;
      }

      default: {
        token_T* token = parser_advance(parser);
        buffer_append(&content, token->value);
        token_free(token);
      }
    }
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
  array_T* errors = array_init(1);

  if (parser->current_token->type != TOKEN_IDENTIFIER) {
    AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node =
      parser_init_unexpected_token_from_current_token(parser, TOKEN_IDENTIFIER);
    array_append(errors, unexpected_token_node);
  }

  token_T* identifier = parser_consume_expected(parser, TOKEN_IDENTIFIER, errors);

  AST_HTML_ATTRIBUTE_NAME_NODE_T* attribute_name =
    ast_html_attribute_name_node_init(identifier, identifier->start, identifier->end, errors);

  token_free(identifier);

  return attribute_name;
}

static AST_HTML_ATTRIBUTE_VALUE_NODE_T* parser_parse_html_attribute_value(parser_T* parser) {
  array_T* children = array_init(8);
  array_T* errors = array_init(1);
  token_T* open_quote = NULL;
  token_T* close_quote = NULL;

  location_T* start_location = location_copy(parser->current_token->start);

  switch (parser->current_token->type) {
    case TOKEN_ERB_START: {
      array_append(children, parser_parse_erb_tag(parser));
      break;
    }

    case TOKEN_QUOTE: {
      open_quote = parser_consume_expected(parser, TOKEN_QUOTE, errors);
      buffer_T buffer = buffer_new();

      location_free(start_location);
      start_location = location_copy(parser->current_token->start);

      while (parser->current_token->type != TOKEN_QUOTE && parser->current_token->type != TOKEN_EOF) {
        switch (parser->current_token->type) {
          case TOKEN_ERB_START: {
            if (buffer_length(&buffer) > 0) {
              AST_LITERAL_NODE_T* literal =
                ast_literal_node_init(buffer_value(&buffer), start_location, parser->current_token->start, NULL);

              buffer_clear(&buffer);
              array_append(children, literal);
            }

            array_append(children, parser_parse_erb_tag(parser));

            location_free(start_location);
            start_location = location_copy(parser->current_token->start);
          } break;

          default: {
            buffer_append(&buffer, parser->current_token->value);
            token_free(parser->current_token);
            parser->current_token = lexer_next_token(parser->lexer);
          }
        }
      }

      if (buffer_length(&buffer) > 0) {
        AST_LITERAL_NODE_T* literal =
          ast_literal_node_init(buffer_value(&buffer), start_location, parser->current_token->start, NULL);
        array_append(children, literal);
      }

      buffer_free(&buffer);

      close_quote = parser_consume_expected(parser, TOKEN_QUOTE, errors);

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
    } break;

    case TOKEN_IDENTIFIER: {
      token_T* identifier = parser_consume_expected(parser, TOKEN_IDENTIFIER, errors);
      AST_LITERAL_NODE_T* literal_node = ast_literal_node_init_from_token(identifier);

      array_append(children, literal_node);
      token_free(identifier);
    } break;

    default: {
      token_T* token = parser_advance(parser);
      AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node =
        ast_unexpected_token_node_init_from_token(token, "TOKEN_IDENTIFIER, TOKEN_QUOTE, TOKEN_ERB_START");
      token_free(token);

      array_append(errors, unexpected_token_node);
    } break;
  }

  if (open_quote != NULL && close_quote != NULL) {
    AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node = ast_html_attribute_value_node_init(
      open_quote,
      children,
      close_quote,
      true,
      open_quote->start,
      close_quote->end,
      errors
    );

    location_free(start_location);
    token_free(open_quote);
    token_free(close_quote);

    return value_node;
  }

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node = ast_html_attribute_value_node_init(
    open_quote,
    children,
    close_quote,
    false,
    start_location,
    parser->current_token->start,
    errors
  );

  location_free(start_location);
  token_free(open_quote);
  token_free(close_quote);

  return value_node;
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

static AST_HTML_OPEN_TAG_NODE_T* parser_parse_html_open_tag(parser_T* parser) {
  array_T* errors = array_init(1);
  array_T* children = array_init(8);
  array_T* attributes = array_init(8);

  token_T* tag_start = parser_consume_expected(parser, TOKEN_HTML_TAG_START, errors);
  token_T* tag_name = parser_consume_expected(parser, TOKEN_IDENTIFIER, errors);

  while (parser->current_token->type != TOKEN_HTML_TAG_END && parser->current_token->type != TOKEN_HTML_TAG_SELF_CLOSE
         && parser->current_token->type != TOKEN_EOF) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START: {
        AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
        array_append(children, erb_node);
      } break;

      case TOKEN_WHITESPACE: {
        token_T* token = parser_consume_expected(parser, TOKEN_WHITESPACE, errors);
        token_free(token);
      } break;

      case TOKEN_IDENTIFIER: {
        AST_HTML_ATTRIBUTE_NODE_T* attribute = parser_parse_html_attribute(parser);

        array_append(attributes, attribute);
      } break;

      default: {
        token_T* token = parser_advance(parser);
        AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node =
          ast_unexpected_token_node_init_from_token(token, "TOKEN_IDENTIFIER, TOKEN_ERB_START, or TOKEN_WHITESPACE");
        token_free(token);

        array_append(errors, unexpected_token_node);
        break;
      }
    }
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
  array_T* errors = array_init(1);

  token_T* tag_opening = parser_consume_expected(parser, TOKEN_HTML_TAG_START_CLOSE, errors);
  token_T* tag_name = parser_consume_expected(parser, TOKEN_IDENTIFIER, errors);
  token_T* tag_closing = parser_consume_expected(parser, TOKEN_HTML_TAG_END, errors);

  AST_HTML_CLOSE_TAG_NODE_T* close_tag =
    ast_html_close_tag_node_init(tag_opening, tag_name, tag_closing, tag_opening->start, tag_closing->end, errors);

  token_free(tag_opening);
  token_free(tag_name);
  token_free(tag_closing);

  return close_tag;
}

static AST_HTML_ELEMENT_NODE_T* parser_parse_html_element(parser_T* parser) {
  array_T* errors = array_init(1);
  AST_HTML_OPEN_TAG_NODE_T* open_tag = parser_parse_html_open_tag(parser);

  // TODO: attach information if the open tag should have a close tag based on the is_void_element value.
  // open_tag->should_have_close_tag = is_void_element(open_tag->name);

  if (open_tag->base.type == AST_HTML_SELF_CLOSE_TAG_NODE || is_void_element(open_tag->tag_name->value)) {
    return ast_html_element_node_init(
      open_tag,
      open_tag->tag_name,
      NULL,
      NULL,
      true,
      open_tag->base.start,
      open_tag->base.end,
      errors
    );
  }

  if (open_tag->base.type == AST_HTML_OPEN_TAG_NODE) {
    array_T* body = array_init(8);

    parser_parse_in_data_state(parser, body, errors);

    AST_HTML_CLOSE_TAG_NODE_T* close_tag = parser_parse_html_close_tag(parser);

    if (strcasecmp(open_tag->tag_name->value, close_tag->tag_name->value) != 0
        && string_present(open_tag->tag_name->value) && string_present(close_tag->tag_name->value)) {
      AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = ast_unexpected_token_node_init_from_raw_message(
        close_tag->base.start,
        close_tag->base.end,
        "mismatched closing tag",
        open_tag->tag_name->value,
        close_tag->tag_name->value
      );

      array_append(errors, unexpected_token_node);
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

  AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = ast_unexpected_token_node_init_from_raw_message(
    open_tag->base.start,
    open_tag->base.end,
    "open_tag type",
    "AST_HTML_OPEN_TAG_NODE or AST_HTML_SELF_CLOSE_TAG_NODE",
    open_tag->tag_name->value
  );

  array_append(element_node->body, unexpected_token_node);

  return element_node;
}

static AST_ERB_CONTENT_NODE_T* parser_parse_erb_tag(parser_T* parser) {
  array_T* errors = array_init(1);

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
  while (parser->current_token->type != TOKEN_EOF && parser->current_token->type != TOKEN_HTML_TAG_START_CLOSE) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START: {
        AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
        array_append(children, erb_node);
        break;
      }

      case TOKEN_HTML_DOCTYPE: {
        AST_HTML_DOCTYPE_NODE_T* doctype_node = parser_parse_html_doctype(parser);
        array_append(children, doctype_node);
        break;
      }

      case TOKEN_HTML_COMMENT_START: {
        AST_HTML_COMMENT_NODE_T* comment = parser_parse_html_comment(parser);
        array_append(children, comment);
        break;
      }

      case TOKEN_HTML_TAG_START: {
        AST_HTML_ELEMENT_NODE_T* element_node = parser_parse_html_element(parser);
        array_append(children, element_node);
        break;
      }

      case TOKEN_IDENTIFIER:
      case TOKEN_WHITESPACE:
      case TOKEN_NEWLINE: {
        AST_HTML_TEXT_NODE_T* text_node = parser_parse_text_content(parser);
        array_append(children, text_node);
        break;
      }

      case TOKEN_HTML_TAG_START_CLOSE:
      case TOKEN_EOF: {
        break;
      }

      default: {
        token_T* token = parser_advance(parser);
        const char* actual_type = token_type_to_string(token->type);

        size_t length = snprintf(NULL, 0, "not %s", actual_type) + 1;
        char* expected = malloc(length);

        if (expected != NULL) {
          snprintf(expected, length, "not %s", actual_type);

          AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node =
            ast_unexpected_token_node_init_from_token(token, expected);

          array_append(errors, unexpected_token_node);
          free(expected);
        } else {
          printf("unexpected token type: %s\n", token_type_to_string(token->type));
        }

        token_free(token);
      } break;
    }
  }
}

static AST_DOCUMENT_NODE_T* parser_parse_document(parser_T* parser) {
  array_T* children = array_init(8);

  AST_DOCUMENT_NODE_T* document_node =
    ast_document_node_init(children, parser->current_token->start, parser->current_token->start, NULL);

  parser_parse_in_data_state(parser, document_node->children, document_node->base.errors);

  token_T* eof = parser_consume_expected(parser, TOKEN_EOF, document_node->base.errors);
  ast_node_set_end(&document_node->base, eof->end);

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

  free(parser);
}
