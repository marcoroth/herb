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

static void parser_parse_in_data_state(parser_T* parser, AST_NODE_T* element);
static AST_NODE_T* parser_parse_erb_tag(parser_T* parser, AST_NODE_T* element);
static AST_NODE_T* parser_build_node(parser_T* parser, ast_node_type_T type, char* name, AST_NODE_T* node);

size_t parser_sizeof(void) {
  return sizeof(struct PARSER_STRUCT);
}

parser_T* parser_init(lexer_T* lexer) {
  parser_T* parser = calloc(1, parser_sizeof());
  parser->lexer = lexer;
  parser->current_token = lexer_next_token(lexer);

  return parser;
}

static char* format_parser_error(const char* message, const char* expected, const char* got) {
  char* template = "[Parser]: Unexpected Token %s (expected '%s', got: '%s')";
  int needed = snprintf(NULL, 0, template, message, expected, got);

  if (needed < 0) { return NULL; }

  char* buffer = malloc(needed + 1);
  if (!buffer) { return NULL; }

  snprintf(buffer, needed + 1, template, message, expected, got);

  return buffer;
}

static AST_NODE_T* parser_append_unexpected_token(
  parser_T* parser, location_T* start, location_T* end, char* message, char* expected, char* actual, AST_NODE_T* node
) {
  AST_NODE_T* unexpected_token = ast_node_init(AST_UNEXCPECTED_TOKEN_NODE);
  unexpected_token->name = escape_newlines(format_parser_error(message, expected, actual));
  ast_node_set_start(unexpected_token, start);
  ast_node_set_end(unexpected_token, end);

  array_append(node->children, unexpected_token);

  return unexpected_token;
}

static AST_NODE_T* parser_append_unexpected_token_from_token(parser_T* parser, token_type_T type, AST_NODE_T* node) {
  token_T* token = parser_consume(parser, type, node);

  return parser_append_unexpected_token(
    parser,
    token->start,
    token->end,
    token->value,
    (char*) token_type_to_string(parser->current_token->type),
    (char*) token_type_to_string(type),
    node
  );
}

token_T* parser_consume(parser_T* parser, token_type_T type, AST_NODE_T* node) {
  if (parser->current_token->type != type) {
    parser_append_unexpected_token(
      parser,
      parser->current_token->start,
      parser->current_token->end,
      "in parser_consume",
      (char*) token_type_to_string(type),
      (char*) token_type_to_string(parser->current_token->type),
      node
    );
  } else {
    if (0 == 1) { printf("[Parser]: Consumed token '%s'\n", token_to_string(parser->current_token)); }
  }

  token_T* token = parser->current_token;

  parser->current_token = lexer_next_token(parser->lexer);

  return token;
}

static void parser_set_start_from_current_token(parser_T* parser, AST_NODE_T* node) {
  ast_node_set_start(node, parser->current_token->start);
}

static void parser_set_end_from_current_token(parser_T* parser, AST_NODE_T* node) {
  ast_node_set_end(node, parser->current_token->start);
}

static token_T* parser_consume_as_start_token(parser_T* parser, token_type_T type, AST_NODE_T* node) {
  token_T* token = parser_consume(parser, type, node);
  ast_node_set_start_from_token(node, token);
  return token;
}

static token_T* parser_consume_as_end_token(parser_T* parser, token_type_T type, AST_NODE_T* node) {
  token_T* token = parser_consume(parser, type, node);
  ast_node_set_end_from_token(node, token);
  return token;
}

static token_T* parser_consume_token_with_location(parser_T* parser, token_type_T type, AST_NODE_T* node) {
  token_T* token = parser_consume(parser, type, node);
  ast_node_set_locations_from_token(node, token);
  return token;
}

static AST_NODE_T* parser_parse_html_comment(parser_T* parser, AST_NODE_T* element) {
  AST_NODE_T* comment_node = ast_node_init(AST_HTML_COMMENT_NODE);

  parser_consume_as_start_token(parser, TOKEN_HTML_COMMENT_START, comment_node);
  location_T* start_location = parser->current_token->start;

  buffer_T comment = buffer_new();

  while (parser->current_token->type != TOKEN_EOF && parser->current_token->type != TOKEN_HTML_COMMENT_END) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START: {
        AST_NODE_T* literal = parser_build_node(parser, AST_LITERAL_NODE, buffer_value(&comment), comment_node);
        literal->start = start_location;
        literal->end = parser->current_token->start;

        comment = buffer_new();
        parser_parse_erb_tag(parser, comment_node);
        start_location = parser->current_token->start;

        break;
      }

      default: {
        token_T* token = parser_consume(parser, parser->current_token->type, comment_node);
        buffer_append(&comment, token->value);
      }
    }
  }

  if (buffer_length(&comment) >= 0) {
    AST_NODE_T* literal = parser_build_node(parser, AST_LITERAL_NODE, buffer_value(&comment), comment_node);
    literal->start = start_location;
    literal->end = parser->current_token->start;
  }

  parser_consume_as_end_token(parser, TOKEN_HTML_COMMENT_END, comment_node);

  array_append(element->children, comment_node);

  return comment_node;
}

static AST_NODE_T* parser_parse_html_doctype(parser_T* parser, AST_NODE_T* element) {
  AST_NODE_T* doctype = ast_node_init(AST_HTML_DOCTYPE_NODE);
  buffer_T content = buffer_new();

  parser_consume_as_start_token(parser, TOKEN_HTML_DOCTYPE, doctype);

  while (parser->current_token->type != TOKEN_EOF && parser->current_token->type != TOKEN_HTML_TAG_END) {
    token_T* token = parser_consume(parser, parser->current_token->type, doctype);
    buffer_append(&content, token->value);
  }

  parser_consume_as_end_token(parser, TOKEN_HTML_TAG_END, doctype);

  doctype->name = buffer_value(&content);

  array_append(element->children, doctype);

  return doctype;
}

static AST_NODE_T* parser_parse_text_content(parser_T* parser, AST_NODE_T* element) {
  AST_NODE_T* text_content_node = ast_node_init(AST_HTML_TEXT_NODE);

  location_T* start_location = parser->current_token->start;

  buffer_T content = buffer_new();

  while (parser->current_token->type != TOKEN_EOF && parser->current_token->type != TOKEN_HTML_TAG_START
         && parser->current_token->type != TOKEN_HTML_TAG_START_CLOSE
         && parser->current_token->type != TOKEN_HTML_COMMENT_START) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START: {
        if (buffer_length(&content) > 0) {
          AST_NODE_T* text_content = parser_build_node(parser, AST_HTML_TEXT_NODE, buffer_value(&content), element);
          content = buffer_new();
          text_content->start = start_location;
          text_content->end = parser->current_token->start;
        }

        parser_parse_erb_tag(parser, element);

        start_location = parser->current_token->start;
      } break;

      case TOKEN_EOF:
      case TOKEN_HTML_TAG_START:
      case TOKEN_HTML_TAG_START_CLOSE: {
        break;
      }

      default: {
        token_T* token = parser_consume(parser, parser->current_token->type, text_content_node);
        buffer_append(&content, token->value);
      }
    }
  }

  if (buffer_length(&content) > 0) {
    text_content_node->name = buffer_value(&content);
    text_content_node->start = start_location;
    text_content_node->end = parser->current_token->start;

    array_append(element->children, text_content_node);
  } else {
    // TODO: we shouldn't be interrupting the text_content parsing in the switch above
    // TODO: implement ast_node_free()
    // ast_node_free(text_content_node);
  }

  return text_content_node;
}

static AST_NODE_T* parser_parse_html_attribute_name(parser_T* parser, AST_NODE_T* attribute) {
  AST_NODE_T* attribute_name = ast_node_init(AST_HTML_ATTRIBUTE_NAME_NODE);

  if (parser->current_token->type != TOKEN_IDENTIFIER) {
    parser_append_unexpected_token_from_token(parser, TOKEN_IDENTIFIER, attribute_name);
  } else {
    token_T* identifier = parser_consume_token_with_location(parser, TOKEN_IDENTIFIER, attribute_name);
    attribute_name->name = identifier->value;
    attribute->start = attribute_name->start;
    attribute->end = attribute_name->end;
  }

  array_append(attribute->children, attribute_name);

  return attribute_name;
}

static AST_NODE_T* parser_build_node(parser_T* parser, ast_node_type_T type, char* name, AST_NODE_T* node) {
  AST_NODE_T* literal_node = ast_node_init(type);

  literal_node->name = name;
  array_append(node->children, literal_node);

  return literal_node;
}

static AST_NODE_T* parser_parse_html_attribute_value(parser_T* parser, AST_NODE_T* attribute) {
  AST_NODE_T* attribute_value = ast_node_init(AST_HTML_ATTRIBUTE_VALUE_NODE);

  parser_set_start_from_current_token(parser, attribute_value);

  switch (parser->current_token->type) {
    case TOKEN_ERB_START: {
      parser_parse_erb_tag(parser, attribute_value);
      break;
    }

    case TOKEN_QUOTE: {
      token_T* open_quote = parser_consume(parser, TOKEN_QUOTE, attribute_value);
      buffer_T buffer = buffer_new();

      location_T* start_location = parser->current_token->start;

      while (parser->current_token->type != TOKEN_QUOTE && parser->current_token->type != TOKEN_EOF) {
        switch (parser->current_token->type) {
          case TOKEN_ERB_START: {
            if (buffer_length(&buffer) > 0) {
              AST_NODE_T* literal = parser_build_node(parser, AST_LITERAL_NODE, buffer_value(&buffer), attribute_value);
              literal->start = start_location;
              literal->end = parser->current_token->start;

              buffer = buffer_new();
            }

            parser_parse_erb_tag(parser, attribute_value);

            start_location = parser->current_token->start;
          } break;

          default: {
            buffer_append(&buffer, parser->current_token->value);
            parser->current_token = lexer_next_token(parser->lexer);
          }
        }
      }

      if (buffer_length(&buffer) > 0) {
        AST_NODE_T* literal = parser_build_node(parser, AST_LITERAL_NODE, buffer_value(&buffer), attribute_value);
        literal->start = start_location;
        literal->end = parser->current_token->start;
      }

      token_T* close_quote = parser_consume(parser, TOKEN_QUOTE, attribute_value);

      if (strcmp(open_quote->value, close_quote->value) != 0) {
        parser_append_unexpected_token(
          parser,
          close_quote->start,
          close_quote->end,
          "Unexpected quote",
          open_quote->value,
          close_quote->value,
          attribute_value
        );
      }

      attribute_value->name = buffer_value(&buffer);
    } break;

    case TOKEN_IDENTIFIER: {
      attribute_value->name = parser_consume(parser, TOKEN_IDENTIFIER, attribute_value)->value;
    } break;

    default: parser_append_unexpected_token_from_token(parser, parser->current_token->type, attribute_value);
  }

  parser_set_end_from_current_token(parser, attribute_value);

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
    AST_NODE_T* attribute_value = parser_parse_html_attribute_value(parser, attribute);
    attribute->end = attribute_value->end;
  }

  array_append(attribute_list->children, attribute);

  return attribute;
}

static AST_NODE_T* parser_parse_html_attribute_set(parser_T* parser) {
  AST_NODE_T* attribute_list = ast_node_init(AST_HTML_ATTRIBUTE_SET_NODE);
  parser_set_start_from_current_token(parser, attribute_list);

  while (parser->current_token->type != TOKEN_HTML_TAG_END && parser->current_token->type != TOKEN_HTML_TAG_SELF_CLOSE
         && parser->current_token->type != TOKEN_EOF) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START: parser_parse_erb_tag(parser, attribute_list); break;
      case TOKEN_WHITESPACE: parser_consume(parser, TOKEN_WHITESPACE, attribute_list); break;
      case TOKEN_IDENTIFIER: parser_parse_html_attribute(parser, attribute_list); break;
      default: parser_append_unexpected_token_from_token(parser, parser->current_token->type, attribute_list); break;
    }
  }

  parser_set_end_from_current_token(parser, attribute_list);

  return attribute_list;
}

static AST_NODE_T* parser_parse_html_open_tag(parser_T* parser, AST_NODE_T* element) {
  token_T* tag_start = parser_consume_as_start_token(parser, TOKEN_HTML_TAG_START, element);
  token_T* tag_name = parser_consume(parser, TOKEN_IDENTIFIER, element);

  AST_NODE_T* attribute_list = parser_parse_html_attribute_set(parser);

  if (parser->current_token->type == TOKEN_HTML_TAG_END) {
    AST_NODE_T* open_tag = ast_node_init(AST_HTML_OPEN_TAG_NODE);
    open_tag->name = tag_name->value;
    open_tag->start = tag_start->start;

    array_append(element->children, open_tag);
    array_append(open_tag->children, attribute_list);
    token_T* tag_end = parser_consume_as_end_token(parser, TOKEN_HTML_TAG_END, open_tag);
    element->end = tag_end->end;

    return open_tag;
  } else if (parser->current_token->type == TOKEN_HTML_TAG_SELF_CLOSE) {
    AST_NODE_T* self_close_tag = ast_node_init(AST_HTML_SELF_CLOSE_TAG_NODE);
    self_close_tag->name = tag_name->value;
    self_close_tag->start = tag_start->start;

    array_append(element->children, self_close_tag);
    array_append(self_close_tag->children, attribute_list);
    token_T* tag_end = parser_consume_as_end_token(parser, TOKEN_HTML_TAG_SELF_CLOSE, self_close_tag);
    element->end = tag_end->end;

    return self_close_tag;
  } else {
    return parser_append_unexpected_token_from_token(parser, parser->current_token->type, element);
  }
}

static AST_NODE_T* parser_parse_html_element_body(parser_T* parser, AST_NODE_T* element) {
  AST_NODE_T* element_body = ast_node_init(AST_HTML_ELEMENT_BODY_NODE);
  parser_set_start_from_current_token(parser, element_body);

  parser_parse_in_data_state(parser, element_body);

  parser_set_end_from_current_token(parser, element_body);
  array_append(element->children, element_body);

  return element_body;
}

static AST_NODE_T* parser_parse_html_close_tag(parser_T* parser, AST_NODE_T* element) {
  AST_NODE_T* close_tag = ast_node_init(AST_HTML_CLOSE_TAG_NODE);

  parser_consume_as_start_token(parser, TOKEN_HTML_TAG_START_CLOSE, close_tag);
  close_tag->name = parser_consume(parser, TOKEN_IDENTIFIER, close_tag)->value;
  parser_consume_as_end_token(parser, TOKEN_HTML_TAG_END, close_tag);

  array_append(element->children, close_tag);
  element->end = close_tag->end;

  return close_tag;
}

static AST_NODE_T* parser_parse_html_element(parser_T* parser, AST_NODE_T* parent) {
  AST_NODE_T* element_node = ast_node_init(AST_HTML_ELEMENT_NODE);
  array_append(parent->children, element_node);

  AST_NODE_T* open_tag = parser_parse_html_open_tag(parser, element_node);

  // TODO: attach information if the open tag should have a close tag based on the is_void_element value.
  // open_tag->should_have_close_tag = is_void_element(open_tag->name);

  if (open_tag->type == AST_HTML_SELF_CLOSE_TAG_NODE || is_void_element(open_tag->name)) {
    // no-op: since we don't expect a close tag

    // To make sure we always set it for the is_void_element cases
    open_tag->type = AST_HTML_SELF_CLOSE_TAG_NODE;

  } else if (open_tag->type == AST_HTML_OPEN_TAG_NODE) {
    parser_parse_html_element_body(parser, element_node);

    AST_NODE_T* close_tag = parser_parse_html_close_tag(parser, element_node);

    if (strcasecmp(open_tag->name, close_tag->name) != 0) {
      parser_append_unexpected_token(
        parser,
        close_tag->start,
        close_tag->end,
        "mismatched closing tag",
        open_tag->name,
        close_tag->name,
        element_node
      );
    }
  } else {
    parser_append_unexpected_token(
      parser,
      open_tag->start,
      open_tag->end,
      "open_tag type",
      "AST_HTML_OPEN_TAG_NODE, AST_HTML_SELF_CLOSE_TAG_NODE",
      open_tag->name,
      element_node
    );
  }

  return element_node;
}

static AST_NODE_T* parser_parse_erb_tag(parser_T* parser, AST_NODE_T* element) {
  AST_NODE_T* erb_tag = ast_node_init(AST_ERB_CONTENT_NODE);

  parser_consume_as_start_token(parser, TOKEN_ERB_START, erb_tag);

  token_T* content = parser_consume(parser, TOKEN_ERB_CONTENT, erb_tag);
  erb_tag->name = content->value;

  parser_consume_as_end_token(parser, TOKEN_ERB_END, erb_tag);

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

      case TOKEN_HTML_DOCTYPE: {
        parser_parse_html_doctype(parser, element);
        break;
      }

      case TOKEN_HTML_COMMENT_START: {
        parser_parse_html_comment(parser, element);
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
  parser_set_start_from_current_token(parser, document_node);

  parser_parse_in_data_state(parser, document_node);

  parser_consume_as_end_token(parser, TOKEN_EOF, document_node);

  return document_node;
}

AST_NODE_T* parser_parse(parser_T* parser) {
  return parser_parse_document(parser);
}
