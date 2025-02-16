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

token_T* parser_consume(parser_T* parser, token_type_T type) {
  if (parser->current_token->type != type) {
    printf("[Parser]: Unexpected token in parser_consume: '%s', expected: '%s'\n",
        token_to_string(parser->current_token),
        token_type_to_string(type));
    exit(1);
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
    printf("[Parser]: Unexpected token in parser_parse_html_attribute_name: '%s', expected: '%s'\n",
        token_to_string(parser->current_token),
        token_type_to_string(TOKEN_IDENTIFIER));
    exit(1);
  }

  attribute_name->name = parser_consume(parser, TOKEN_IDENTIFIER)->value;

  array_append(attribute->children, attribute_name);

  return attribute_name;
}

AST_NODE_T* parser_parse_html_attribute_value(parser_T* parser, AST_NODE_T* attribute) {
  AST_NODE_T* attribute_value = ast_node_init(AST_HTML_ATTRIBUTE_VALUE_NODE);

  switch (parser->current_token->type) {
    case TOKEN_QUOTE: {
      token_T* open_quote = parser_consume(parser, TOKEN_QUOTE);
      buffer_T buffer = buffer_new();

      while (parser->current_token->type != TOKEN_QUOTE && parser->current_token->type != TOKEN_EOF) {
        buffer_append(&buffer, parser->current_token->value);
        parser->current_token = lexer_next_token(parser->lexer);
      }

      token_T* close_quote = parser_consume(parser, TOKEN_QUOTE);

      if (strcmp(open_quote->value, close_quote->value) != 0) {
        printf("[Parser]: Unexpected token in parser_parse_html_attribute_value 1: '%s', expected: '%s'\n",
            close_quote->value,
            open_quote->value);
      }

      attribute_value->name = buffer_value(&buffer);
    } break;

    case TOKEN_IDENTIFIER: {
      attribute_value->name = parser_consume(parser, TOKEN_IDENTIFIER)->value;
    } break;

    default:
      printf("[Parser]: Unexpected token in parser_parse_html_attribute_value 2: '%s'\n",
          token_to_string(parser->current_token));
  }

  array_append(attribute->children, attribute_value);

  return attribute_value;
}

AST_NODE_T* parser_parse_html_attribute(parser_T* parser, AST_NODE_T* attribute_list) {
  AST_NODE_T* attribute = ast_node_init(AST_HTML_ATTRIBUTE_NODE);

  switch (parser->current_token->type) {
    case TOKEN_IDENTIFIER: parser_parse_html_attribute_name(parser, attribute); break;
    default: {
      printf("[Parser]: Unexpected token in parser_parse_html_attribute: '%s'\n",
          token_to_string(parser->current_token));
    }
  }

  if (parser->current_token->type == TOKEN_EQUALS) {
    parser_consume(parser, TOKEN_EQUALS);
    parser_parse_html_attribute_value(parser, attribute);
  }

  array_append(attribute_list->children, attribute);

  return attribute;
}

AST_NODE_T* parser_parse_html_attribute_set(parser_T* parser, AST_NODE_T* open_tag) {
  AST_NODE_T* attribute_list = ast_node_init(AST_HTML_ATTRIBUTE_SET_NODE);

  while (parser->current_token->type != TOKEN_HTML_TAG_END) {
    switch (parser->current_token->type) {
      case TOKEN_WHITESPACE: parser_consume(parser, TOKEN_WHITESPACE); break;
      case TOKEN_IDENTIFIER: parser_parse_html_attribute(parser, attribute_list); break;
      default: {
        printf("Unexpected token in parser_parse_html_attribute_set: '%s'\n", token_to_string(parser->current_token));
        exit(1);
      }
    }
  }

  array_append(open_tag->children, attribute_list);

  return attribute_list;
}

AST_NODE_T* parser_parse_html_open_tag(parser_T* parser) {
  AST_NODE_T* open_tag = ast_node_init(AST_HTML_OPEN_TAG_NODE);

  parser_consume(parser, TOKEN_HTML_TAG_START);
  open_tag->name = parser_consume(parser, TOKEN_IDENTIFIER)->value;

  parser_parse_html_attribute_set(parser, open_tag);

  parser_consume(parser, TOKEN_HTML_TAG_END);

  return open_tag;
}

AST_NODE_T* parser_parse_html_close_tag(parser_T* parser) {
  AST_NODE_T* close_tag = ast_node_init(AST_HTML_CLOSE_TAG_NODE);

  parser_consume(parser, TOKEN_HTML_TAG_START_CLOSE);
  close_tag->name = parser_consume(parser, TOKEN_IDENTIFIER)->value;
  parser_consume(parser, TOKEN_HTML_TAG_END);

  return close_tag;
}

AST_NODE_T* parser_parse_html_element(parser_T* parser, AST_NODE_T* parent) {
  AST_NODE_T* element_node = ast_node_init(AST_HTML_ELEMENT_NODE);

  AST_NODE_T* open_tag = parser_parse_html_open_tag(parser);
  AST_NODE_T* close_tag = parser_parse_html_close_tag(parser);

  array_append(element_node->children, open_tag);
  array_append(element_node->children, close_tag);

  if (strcmp(open_tag->name, close_tag->name) != 0) {
    printf("[Parser]: Error - Mismatched closing tag. Expected '%s', got '%s'.\n", open_tag->name, close_tag->name);

    AST_NODE_T* mismatch = ast_node_init(AST_NOOP_NODE);
    mismatch->name = close_tag->name;
    array_append(element_node->children, mismatch);
  }

  array_append(parent->children, element_node);

  return element_node;
}

AST_NODE_T* parser_parse_document(parser_T* parser) {
  AST_NODE_T* document_node = ast_node_init(AST_HTML_DOCUMENT_NODE);

  while (parser->current_token->type != TOKEN_EOF) {
    switch (parser->current_token->type) {
      case TOKEN_HTML_TAG_START: parser_parse_html_element(parser, document_node); break;
      case TOKEN_EOF: { /* NOOP */
      } break;
      default: {
        printf("[Parser]: Unexpected token in parser_parse_document: '%s'\n", token_to_string(parser->current_token));
        exit(1);
      }
    }
  }

  return document_node;
}

AST_NODE_T* parser_parse(parser_T* parser) {
  return parser_parse_document(parser);
}
