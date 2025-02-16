#include "include/parser.h"
#include "include/array.h"
#include "include/ast_node.h"
#include "include/buffer.h"
#include "include/lexer.h"
#include "include/token.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

size_t parser_sizeof(void) {
  return sizeof(struct PARSER_STRUCT);
}

parser_T* parser_init(lexer_T* lexer) {
  parser_T* parser = calloc(1, parser_sizeof());
  parser->lexer = lexer;
  parser->current_token = lexer_next_token(lexer);

  return parser;
}

#include <stdio.h>
#include <stdlib.h>

char* format_parser_error(const char* message, const char* expected, const char* actual) {
  int needed = snprintf(NULL, 0, "[Parser]: Unexpected Token: '%s': expected '%s', got: '%s'\n", message, expected, actual);

  if (needed < 0) {
    return NULL;
  }

  char* buffer = malloc(needed + 1);
  if (!buffer) {
    return NULL;
  }

  snprintf(buffer, needed + 1, "[Parser]: Unexpected Token: '%s': expected '%s', got: '%s'\n", message, expected, actual);

  return buffer;
}

AST_NODE_T* parser_append_unexpected_token(parser_T* parser, char* message, char* expected, char* actual, AST_NODE_T* node) {
  AST_NODE_T* unexpected_token = ast_node_init(AST_UNEXCPECTED_TOKEN_NODE);
  unexpected_token->name = format_parser_error(message, expected, actual);
  array_append(node->children, unexpected_token);
  printf("%zu", parser->current_token->range->start);

  return unexpected_token;
}

AST_NODE_T* parser_append_unexpected_token_from_token(parser_T* parser, token_type_T type, AST_NODE_T* node) {
  token_T* token = parser_consume(parser, type, node);

  return parser_append_unexpected_token(parser, token->value, (char*) token_type_to_string(type), (char*) token_type_to_string(parser->current_token->type), node);
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

AST_NODE_T* parser_parse_html_attribute_name(parser_T* parser, AST_NODE_T* attribute) {
  AST_NODE_T* attribute_name = ast_node_init(AST_HTML_ATTRIBUTE_NAME_NODE);

  if (parser->current_token->type != TOKEN_IDENTIFIER) {
    parser_append_unexpected_token_from_token(parser, TOKEN_IDENTIFIER, attribute_name);
  } else {
    attribute_name->name = parser_consume(parser, TOKEN_IDENTIFIER, attribute)->value;
  }

  array_append(attribute->children, attribute_name);

  return attribute_name;
}

AST_NODE_T* parser_parse_html_attribute_value(parser_T* parser, AST_NODE_T* attribute) {
  AST_NODE_T* attribute_value = ast_node_init(AST_HTML_ATTRIBUTE_VALUE_NODE);

  switch (parser->current_token->type) {
    case TOKEN_QUOTE: {
      token_T* open_quote = parser_consume(parser, TOKEN_QUOTE, attribute_value);
      buffer_T buffer = buffer_new();

      while (parser->current_token->type != TOKEN_QUOTE && parser->current_token->type != TOKEN_EOF) {
        buffer_append(&buffer, parser->current_token->value);
        parser->current_token = lexer_next_token(parser->lexer);
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

AST_NODE_T* parser_parse_html_attribute(parser_T* parser, AST_NODE_T* attribute_list) {
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

AST_NODE_T* parser_parse_html_attribute_set(parser_T* parser) {
  AST_NODE_T* attribute_list = ast_node_init(AST_HTML_ATTRIBUTE_SET_NODE);

  while (parser->current_token->type != TOKEN_HTML_TAG_END &&
         parser->current_token->type != TOKEN_HTML_TAG_SELF_CLOSE && parser->current_token->type != TOKEN_EOF) {
    switch (parser->current_token->type) {
      case TOKEN_WHITESPACE: parser_consume(parser, TOKEN_WHITESPACE, attribute_list); break;
      case TOKEN_IDENTIFIER: parser_parse_html_attribute(parser, attribute_list); break;
      default: parser_append_unexpected_token_from_token(parser, TOKEN_COLON, attribute_list); break;
    }
  }

  return attribute_list;
}

AST_NODE_T* parser_parse_html_open_tag(parser_T* parser, AST_NODE_T* element) {
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

AST_NODE_T* parser_parse_html_close_tag(parser_T* parser, AST_NODE_T* element) {
  AST_NODE_T* close_tag = ast_node_init(AST_HTML_CLOSE_TAG_NODE);

  parser_consume(parser, TOKEN_HTML_TAG_START_CLOSE, close_tag);
  close_tag->name = parser_consume(parser, TOKEN_IDENTIFIER, close_tag)->value;
  parser_consume(parser, TOKEN_HTML_TAG_END, close_tag);

  array_append(element->children, close_tag);

  return close_tag;
}

AST_NODE_T* parser_parse_html_element(parser_T* parser, AST_NODE_T* parent) {
  AST_NODE_T* element_node = ast_node_init(AST_HTML_ELEMENT_NODE);
  array_append(parent->children, element_node);

  AST_NODE_T* open_tag = parser_parse_html_open_tag(parser, element_node);

  if (open_tag->type == AST_HTML_OPEN_TAG_NODE) {
    AST_NODE_T* close_tag = parser_parse_html_close_tag(parser, element_node);

    if (strcmp(open_tag->name, close_tag->name) != 0) {
      parser_append_unexpected_token(parser,
          "Mismatched closing tag",
          open_tag->name,
          close_tag->name,
          element_node);

      AST_NODE_T* mismatch = ast_node_init(AST_NOOP_NODE);
      mismatch->name = close_tag->name;
      array_append(element_node->children, mismatch);
    }
  } else if (open_tag->type == AST_HTML_SELF_CLOSE_TAG_NODE) {
    // no-op
  } else {
    parser_append_unexpected_token(parser,
        "open_tag type",
        "AST_HTML_OPEN_TAG_NODE, AST_HTML_SELF_CLOSE_TAG_NODE",
        open_tag->name,
        element_node);
  }

  return element_node;
}

AST_NODE_T* parser_parse_document(parser_T* parser) {
  AST_NODE_T* document_node = ast_node_init(AST_HTML_DOCUMENT_NODE);

  while (parser->current_token->type != TOKEN_EOF) {
    switch (parser->current_token->type) {
      case TOKEN_HTML_TAG_START: parser_parse_html_element(parser, document_node); break;
      case TOKEN_EOF: break;
      default: parser_append_unexpected_token_from_token(parser, parser->current_token->type, document_node); break;
    }
  }

  return document_node;
}

AST_NODE_T* parser_parse(parser_T* parser) {
  return parser_parse_document(parser);
}
