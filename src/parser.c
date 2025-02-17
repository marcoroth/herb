#include "include/parser.h"
#include "include/array.h"
#include "include/ast_node.h"
#include "include/buffer.h"
#include "include/html_util.h"
#include "include/lexer.h"
#include "include/token.h"
#include "include/util.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

size_t parser_sizeof(void) {
  return sizeof(struct PARSER_STRUCT);
}

parser_T* parser_init(lexer_T* lexer) {
  parser_T* parser = calloc(1, parser_sizeof());
  parser->lexer = lexer;
  parser->current_token = lexer_next_token(lexer);

  return parser;
}

static void parser_parse_in_data_state(parser_T* parser, AST_NODE_T* element);
static AST_NODE_T* parser_parse_erb_tag(parser_T* parser, AST_NODE_T* element);

static char* format_parser_error(const char* message, const char* expected, const char* actual) {
  int needed = snprintf(NULL, 0, "[Parser]: Unexpected Token %s (expected '%s', got: '%s')", message, expected, actual);

  if (needed < 0) {
    return NULL;
  }

  char* buffer = malloc(needed + 1);
  if (!buffer) {
    return NULL;
  }

  snprintf(buffer, needed + 1, "[Parser]: Unexpected Token %s (expected '%s', got: '%s')", message, expected, actual);

  return buffer;
}

static AST_NODE_T* parser_append_unexpected_token(
    parser_T* parser, char* message, char* expected, char* actual, AST_NODE_T* node) {
  AST_NODE_T* unexpected_token = ast_node_init(AST_UNEXCPECTED_TOKEN_NODE);
  unexpected_token->name = escape_newlines(format_parser_error(message, expected, actual));
  array_append(node->children, unexpected_token);

  return unexpected_token;
}

static AST_NODE_T* parser_append_unexpected_token_from_token(parser_T* parser, token_type_T type, AST_NODE_T* node) {
  token_T* token = parser_consume(parser, type, node);

  return parser_append_unexpected_token(parser,
      token->value,
      (char*) token_type_to_string(parser->current_token->type),
      (char*) token_type_to_string(type),
      node);
}

token_T* parser_consume(parser_T* parser, token_type_T type, AST_NODE_T* node) {
  if (parser->current_token->type != type) {
    parser_append_unexpected_token(parser,
        "in parser_consume",
        (char*) token_type_to_string(type),
        (char*) token_type_to_string(parser->current_token->type),
        node);
  } else {
    if (0 == 1) {
      printf("[Parser]: Consumed token '%s'\n", token_to_string(parser->current_token));
    }
  }

  token_T* token = parser->current_token;

  parser->current_token = lexer_next_token(parser->lexer);

  return token;
}

static AST_NODE_T* parser_parse_text_content(parser_T* parser, AST_NODE_T* element) {
  AST_NODE_T* text_content_node = ast_node_init(AST_HTML_TEXT_NODE);

  buffer_T content = buffer_new();

  while (parser->current_token->type != TOKEN_EOF && parser->current_token->type != TOKEN_HTML_TAG_START &&
         parser->current_token->type != TOKEN_HTML_TAG_START_CLOSE) {
    switch (parser->current_token->type) {
      case TOKEN_IDENTIFIER: {
        token_T* identifier = parser_consume(parser, TOKEN_IDENTIFIER, text_content_node);

        buffer_append(&content, identifier->value);
      } break;

      case TOKEN_WHITESPACE: {
        token_T* whitespace = parser_consume(parser, TOKEN_WHITESPACE, text_content_node);
        buffer_append(&content, whitespace->value);
      } break;

      case TOKEN_NEWLINE: {
        token_T* newline = parser_consume(parser, TOKEN_NEWLINE, text_content_node);
        buffer_append(&content, newline->value);
      } break;

      case TOKEN_EOF:
      case TOKEN_HTML_TAG_START:
      case TOKEN_HTML_TAG_START_CLOSE: {
        break;
      }

      default: {
        parser_append_unexpected_token_from_token(parser, parser->current_token->type, text_content_node);
      }
    }
  }

  text_content_node->name = buffer_value(&content);

  array_append(element->children, text_content_node);

  return text_content_node;
}

static AST_NODE_T* parser_parse_html_attribute_name(parser_T* parser, AST_NODE_T* attribute) {
  AST_NODE_T* attribute_name = ast_node_init(AST_HTML_ATTRIBUTE_NAME_NODE);

  if (parser->current_token->type != TOKEN_IDENTIFIER) {
    parser_append_unexpected_token_from_token(parser, TOKEN_IDENTIFIER, attribute_name);
  } else {
    attribute_name->name = parser_consume(parser, TOKEN_IDENTIFIER, attribute)->value;
  }

  array_append(attribute->children, attribute_name);

  return attribute_name;
}

static AST_NODE_T* parser_parse_literal(parser_T* parser, char* name, AST_NODE_T* element) {
  AST_NODE_T* literal_node = ast_node_init(AST_LITERAL_NODE);

  literal_node->name = name;
  array_append(element->children, literal_node);

  return literal_node;
}

static AST_NODE_T* parser_parse_html_attribute_value(parser_T* parser, AST_NODE_T* attribute) {
  AST_NODE_T* attribute_value = ast_node_init(AST_HTML_ATTRIBUTE_VALUE_NODE);

  switch (parser->current_token->type) {
    case TOKEN_ERB_START: {
      parser_parse_erb_tag(parser, attribute_value);
      break;
    }

    case TOKEN_QUOTE: {
      token_T* open_quote = parser_consume(parser, TOKEN_QUOTE, attribute_value);
      buffer_T buffer = buffer_new();

      while (parser->current_token->type != TOKEN_QUOTE && parser->current_token->type != TOKEN_EOF) {
        switch (parser->current_token->type) {
          case TOKEN_ERB_START: {
            if (buffer_length(&buffer) > 0) {
              parser_parse_literal(parser, buffer_value(&buffer), attribute_value);
              buffer = buffer_new();
            }

            parser_parse_erb_tag(parser, attribute_value);
          } break;

          default: {
            buffer_append(&buffer, parser->current_token->value);
            parser->current_token = lexer_next_token(parser->lexer);
          }
        }
      }

      if (buffer_length(&buffer) > 0) {
        parser_parse_literal(parser, buffer_value(&buffer), attribute_value);
      }

      token_T* close_quote = parser_consume(parser, TOKEN_QUOTE, attribute_value);

      if (strcmp(open_quote->value, close_quote->value) != 0) {
        parser_append_unexpected_token(parser,
            "Unexpected quote",
            open_quote->value,
            close_quote->value,
            attribute_value);
      }

      attribute_value->name = buffer_value(&buffer);
    } break;

    case TOKEN_IDENTIFIER: {
      attribute_value->name = parser_consume(parser, TOKEN_IDENTIFIER, attribute_value)->value;
    } break;

    default: parser_append_unexpected_token_from_token(parser, parser->current_token->type, attribute_value);
  }

  array_append(attribute->children, attribute_value);

  return attribute_value;
}

static AST_NODE_T* parser_parse_html_attribute(parser_T* parser, AST_NODE_T* attribute_list) {
  AST_NODE_T* attribute = ast_node_init(AST_HTML_ATTRIBUTE_NODE);

  switch (parser->current_token->type) {
    case TOKEN_IDENTIFIER: parser_parse_html_attribute_name(parser, attribute); break;
    default: parser_append_unexpected_token_from_token(parser, parser->current_token->type, attribute);
  }

  if (parser->current_token->type == TOKEN_EQUALS) {
    parser_consume(parser, TOKEN_EQUALS, attribute);
    parser_parse_html_attribute_value(parser, attribute);
  }

  array_append(attribute_list->children, attribute);

  return attribute;
}

static AST_NODE_T* parser_parse_html_attribute_set(parser_T* parser) {
  AST_NODE_T* attribute_list = ast_node_init(AST_HTML_ATTRIBUTE_SET_NODE);

  while (parser->current_token->type != TOKEN_HTML_TAG_END &&
         parser->current_token->type != TOKEN_HTML_TAG_SELF_CLOSE && parser->current_token->type != TOKEN_EOF) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START: parser_parse_erb_tag(parser, attribute_list); break;
      case TOKEN_WHITESPACE: parser_consume(parser, TOKEN_WHITESPACE, attribute_list); break;
      case TOKEN_IDENTIFIER: parser_parse_html_attribute(parser, attribute_list); break;
      default: parser_append_unexpected_token_from_token(parser, parser->current_token->type, attribute_list); break;
    }
  }

  return attribute_list;
}

static AST_NODE_T* parser_parse_html_open_tag(parser_T* parser, AST_NODE_T* element) {
  parser_consume(parser, TOKEN_HTML_TAG_START, element);
  token_T* tagName = parser_consume(parser, TOKEN_IDENTIFIER, element);

  AST_NODE_T* attribute_list = parser_parse_html_attribute_set(parser);

  if (parser->current_token->type == TOKEN_HTML_TAG_END) {
    AST_NODE_T* open_tag = ast_node_init(AST_HTML_OPEN_TAG_NODE);
    open_tag->name = tagName->value;

    array_append(element->children, open_tag);
    array_append(open_tag->children, attribute_list);
    parser_consume(parser, TOKEN_HTML_TAG_END, open_tag);

    return open_tag;
  } else if (parser->current_token->type == TOKEN_HTML_TAG_SELF_CLOSE) {
    AST_NODE_T* self_close_tag = ast_node_init(AST_HTML_SELF_CLOSE_TAG_NODE);
    self_close_tag->name = tagName->value;

    array_append(element->children, self_close_tag);
    array_append(self_close_tag->children, attribute_list);
    parser_consume(parser, TOKEN_HTML_TAG_SELF_CLOSE, self_close_tag);

    return self_close_tag;
  } else {
    return parser_append_unexpected_token_from_token(parser, parser->current_token->type, element);
  }
}

static AST_NODE_T* parser_parse_html_element_body(parser_T* parser, AST_NODE_T* element) {
  AST_NODE_T* element_body = ast_node_init(AST_HTML_ELEMENT_BODY_NODE);

  parser_parse_in_data_state(parser, element_body);

  array_append(element->children, element_body);

  return element_body;
}

static AST_NODE_T* parser_parse_html_close_tag(parser_T* parser, AST_NODE_T* element) {
  AST_NODE_T* close_tag = ast_node_init(AST_HTML_CLOSE_TAG_NODE);

  parser_consume(parser, TOKEN_HTML_TAG_START_CLOSE, close_tag);
  close_tag->name = parser_consume(parser, TOKEN_IDENTIFIER, close_tag)->value;
  parser_consume(parser, TOKEN_HTML_TAG_END, close_tag);

  array_append(element->children, close_tag);

  return close_tag;
}

static AST_NODE_T* parser_parse_html_element(parser_T* parser, AST_NODE_T* parent) {
  AST_NODE_T* element_node = ast_node_init(AST_HTML_ELEMENT_NODE);
  array_append(parent->children, element_node);

  AST_NODE_T* open_tag = parser_parse_html_open_tag(parser, element_node);

  // TODO: attach information if the open tag should have a close tag based on the is_void_element value.
  // open_tag->should_have_close_tag = is_void_element(open_tag->name);

  if (open_tag->type == AST_HTML_SELF_CLOSE_TAG_NODE || is_void_element(open_tag->name)) {
    // no-op: since we don't expected a close tag

    // To make sure we always set it for the is_void_element cases
    open_tag->type = AST_HTML_SELF_CLOSE_TAG_NODE;

  } else if (open_tag->type == AST_HTML_OPEN_TAG_NODE) {
    parser_parse_html_element_body(parser, element_node);

    AST_NODE_T* close_tag = parser_parse_html_close_tag(parser, element_node);

    if (strcasecmp(open_tag->name, close_tag->name) != 0) {
      parser_append_unexpected_token(parser, "mismatched closing tag", open_tag->name, close_tag->name, element_node);
    }
  } else {
    parser_append_unexpected_token(parser,
        "open_tag type",
        "AST_HTML_OPEN_TAG_NODE, AST_HTML_SELF_CLOSE_TAG_NODE",
        open_tag->name,
        element_node);
  }

  return element_node;
}

static AST_NODE_T* parser_parse_erb_tag(parser_T* parser, AST_NODE_T* element) {
  AST_NODE_T* erb_tag = ast_node_init(AST_ERB_CONTENT_NODE);

  parser_consume(parser, TOKEN_ERB_START, element);

  token_T* content = parser_consume(parser, TOKEN_ERB_CONTENT, element);
  erb_tag->name = content->value;

  parser_consume(parser, TOKEN_ERB_END, element);

  array_append(element->children, erb_tag);

  return erb_tag;
}

static void parser_parse_in_data_state(parser_T* parser, AST_NODE_T* element) {
  while (parser->current_token->type != TOKEN_EOF && parser->current_token->type != TOKEN_HTML_TAG_START_CLOSE) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START: {
        parser_parse_erb_tag(parser, element);
        break;
      }

      case TOKEN_HTML_TAG_START: {
        parser_parse_html_element(parser, element);
        break;
      }

      case TOKEN_IDENTIFIER:
      case TOKEN_WHITESPACE:
      case TOKEN_NEWLINE: {
        parser_parse_text_content(parser, element);
        break;
      }

      case TOKEN_HTML_TAG_START_CLOSE:
      case TOKEN_EOF: {
        break;
      }

      default: parser_append_unexpected_token_from_token(parser, parser->current_token->type, element); break;
    }
  }
}

static AST_NODE_T* parser_parse_document(parser_T* parser) {
  AST_NODE_T* document_node = ast_node_init(AST_HTML_DOCUMENT_NODE);

  parser_parse_in_data_state(parser, document_node);

  return document_node;
}

AST_NODE_T* parser_parse(parser_T* parser) {
  return parser_parse_document(parser);
}
