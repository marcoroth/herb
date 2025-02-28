#include "include/parser.h"
#include "include/array.h"
#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/buffer.h"
#include "include/html_util.h"
#include "include/lexer.h"
#include "include/token.h"
#include "include/util.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

static array_T* parser_parse_in_data_state(parser_T* parser, AST_NODE_T* element, array_T* children);
static AST_ERB_CONTENT_NODE_T* parser_parse_erb_tag(parser_T* parser, AST_NODE_T* element);

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

static AST_UNEXPECTED_TOKEN_NODE_T* parser_unexpected_token(
  location_T* start, location_T* end, char* message, char* expected, char* actual
) {
  AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token = ast_unexpected_token_node_init(message, expected, actual, start, end);
  unexpected_token->message = escape_newlines(format_parser_error(message, expected, actual));
  ast_node_set_start(&unexpected_token->base, start);
  ast_node_set_end(&unexpected_token->base, end);

  return unexpected_token;
}

static AST_UNEXPECTED_TOKEN_NODE_T* parser_append_unexpected_token_from_token(
  parser_T* parser, token_type_T type, AST_NODE_T* node
) {
  token_T* token = parser_consume(parser, type, node->errors);

  return parser_unexpected_token(
    token->start,
    token->end,
    token->value,
    (char*) token_type_to_string(parser->current_token->type),
    (char*) token_type_to_string(type)
  );
}

token_T* parser_consume(parser_T* parser, token_type_T type, array_T* array) {
  if (parser->current_token->type != type) {
    AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = parser_unexpected_token(
      parser->current_token->start,
      parser->current_token->end,
      "in parser_consume",
      (char*) token_type_to_string(type),
      (char*) token_type_to_string(parser->current_token->type)
    );

    if (array != NULL) {
      array_append(array, unexpected_token_node);
    } else {
      printf("%s\n", unexpected_token_node->message);
    }
  } else {
    if (0 == 1) { printf("[Parser]: Consumed token '%s'\n", token_to_string(parser->current_token)); }
  }

  token_T* token = parser->current_token;

  parser->current_token = lexer_next_token(parser->lexer);

  return token;
}

static AST_HTML_COMMENT_NODE_T* parser_parse_html_comment(parser_T* parser, AST_NODE_T* element) {
  array_T* children = array_init(8);
  token_T* comment_start = parser_consume(parser, TOKEN_HTML_COMMENT_START, element->errors);
  location_T* start_location = parser->current_token->start;

  buffer_T comment = buffer_new();

  while (parser->current_token->type != TOKEN_EOF && parser->current_token->type != TOKEN_HTML_COMMENT_END) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START: {
        if (buffer_length(&comment) > 0) {
          AST_LITERAL_NODE_T* literal =
            ast_literal_node_init(buffer_value(&comment), start_location, parser->current_token->start);
          array_append(children, literal);
          comment = buffer_new();
        }

        AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser, element);
        array_append(children, erb_node);

        start_location = parser->current_token->start;

        break;
      }

      default: {
        token_T* token = parser_consume(parser, parser->current_token->type, element->errors);
        buffer_append(&comment, token->value);
      }
    }
  }

  if (buffer_length(&comment) > 0) {
    AST_LITERAL_NODE_T* literal =
      ast_literal_node_init(buffer_value(&comment), start_location, parser->current_token->start);
    array_append(children, literal);
  }

  token_T* comment_end = parser_consume(parser, TOKEN_HTML_COMMENT_END, element->errors);

  return ast_html_comment_node_init(comment_start, children, comment_end, comment_start->start, comment_end->end);
}

static AST_HTML_DOCTYPE_NODE_T* parser_parse_html_doctype(parser_T* parser, AST_NODE_T* element) {
  array_T* children = array_init(8);
  buffer_T content = buffer_new();

  token_T* tag_opening = parser_consume(parser, TOKEN_HTML_DOCTYPE, element->errors);

  location_T* start_location = parser->current_token->start;

  while (parser->current_token->type != TOKEN_EOF && parser->current_token->type != TOKEN_HTML_TAG_END) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START: {
        if (buffer_length(&content) > 0) {
          array_append(
            children,
            ast_literal_node_init(buffer_value(&content), start_location, parser->current_token->start)
          );
          content = buffer_new();
        }

        AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser, element);
        array_append(children, erb_node);
      } break;

      case TOKEN_HTML_TAG_END:
      case TOKEN_EOF: {
        break;
      }

      default: {
        token_T* token = parser_consume(parser, parser->current_token->type, element->errors);
        buffer_append(&content, token->value);
      }
    }
  }

  if (buffer_length(&content) > 0) {
    AST_LITERAL_NODE_T* literal =
      ast_literal_node_init(buffer_value(&content), start_location, parser->current_token->start);
    array_append(children, literal);
  }

  token_T* tag_closing = parser_consume(parser, TOKEN_HTML_TAG_END, element->errors);

  AST_HTML_DOCTYPE_NODE_T* doctype =
    ast_html_doctype_node_init(tag_opening, children, tag_closing, tag_opening->start, tag_closing->end);

  return doctype;
}

static AST_HTML_TEXT_NODE_T* parser_parse_text_content(parser_T* parser, AST_NODE_T* element) {
  location_T* start_location = parser->current_token->start;

  buffer_T content = buffer_new();

  while (parser->current_token->type != TOKEN_EOF && parser->current_token->type != TOKEN_HTML_TAG_START
         && parser->current_token->type != TOKEN_HTML_TAG_START_CLOSE
         && parser->current_token->type != TOKEN_HTML_DOCTYPE && parser->current_token->type != TOKEN_HTML_COMMENT_START
         && parser->current_token->type != TOKEN_ERB_START) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START:
      case TOKEN_EOF:
      case TOKEN_HTML_TAG_START:
      case TOKEN_HTML_TAG_START_CLOSE: {
        break;
      }

      default: {
        token_T* token = parser_consume(parser, parser->current_token->type, element->errors);
        buffer_append(&content, token->value);
      }
    }
  }

  if (buffer_length(&content) > 0) {
    return ast_html_text_node_init(buffer_value(&content), start_location, parser->current_token->start);
  }

  return ast_html_text_node_init("", start_location, parser->current_token->start);
}

static AST_HTML_ATTRIBUTE_NAME_NODE_T* parser_parse_html_attribute_name(parser_T* parser, AST_NODE_T* attribute) {

  if (parser->current_token->type != TOKEN_IDENTIFIER) {
    AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node =
      parser_append_unexpected_token_from_token(parser, TOKEN_IDENTIFIER, attribute);
    array_append(attribute->errors, unexpected_token_node);
  }

  token_T* identifier = parser_consume(parser, TOKEN_IDENTIFIER, attribute->errors);

  AST_HTML_ATTRIBUTE_NAME_NODE_T* attribute_name =
    ast_html_attribute_name_node_init(identifier, identifier->start, identifier->end);

  return attribute_name;
}

static AST_HTML_ATTRIBUTE_VALUE_NODE_T* parser_parse_html_attribute_value(parser_T* parser, AST_NODE_T* attribute) {
  array_T* children = array_init(8);
  token_T* open_quote = NULL;
  token_T* close_quote = NULL;

  location_T* start_location = parser->current_token->start;

  switch (parser->current_token->type) {
    case TOKEN_ERB_START: {
      array_append(children, parser_parse_erb_tag(parser, attribute));
      break;
    }

    case TOKEN_QUOTE: {
      open_quote = parser_consume(parser, TOKEN_QUOTE, attribute->errors);
      buffer_T buffer = buffer_new();

      start_location = parser->current_token->start;

      while (parser->current_token->type != TOKEN_QUOTE && parser->current_token->type != TOKEN_EOF) {
        switch (parser->current_token->type) {
          case TOKEN_ERB_START: {
            if (buffer_length(&buffer) > 0) {
              AST_LITERAL_NODE_T* literal =
                ast_literal_node_init(buffer_value(&buffer), start_location, parser->current_token->start);

              buffer = buffer_new();
              array_append(children, literal);
            }

            array_append(children, parser_parse_erb_tag(parser, attribute));

            start_location = parser->current_token->start;
          } break;

          default: {
            buffer_append(&buffer, parser->current_token->value);
            parser->current_token = lexer_next_token(parser->lexer);
          }
        }
      }

      if (buffer_length(&buffer) > 0) {
        AST_LITERAL_NODE_T* literal =
          ast_literal_node_init(buffer_value(&buffer), start_location, parser->current_token->start);
        array_append(children, literal);
      }

      close_quote = parser_consume(parser, TOKEN_QUOTE, attribute->errors);

      if (open_quote != NULL && close_quote != NULL && strcmp(open_quote->value, close_quote->value) != 0) {
        AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = parser_unexpected_token(
          close_quote->start,
          close_quote->end,
          "Unexpected quote",
          open_quote->value,
          close_quote->value
        );

        array_append(children, unexpected_token_node); // TODO check if this is right.
      }
    } break;

    case TOKEN_IDENTIFIER: {
      token_T* identifier = parser_consume(parser, TOKEN_IDENTIFIER, attribute->errors);
      AST_LITERAL_NODE_T* literal_node = ast_literal_node_init_from_token(identifier);

      array_append(children, literal_node);
    } break;

    default: {
      AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node =
        parser_append_unexpected_token_from_token(parser, parser->current_token->type, attribute);

      array_append(children, unexpected_token_node); // TODO: check if this is right.
    } break;
  }

  if (open_quote != NULL && close_quote != NULL) {
    return ast_html_attribute_value_node_init(
      open_quote,
      children,
      close_quote,
      true,
      open_quote->start,
      close_quote->end
    );
  } else {
    return ast_html_attribute_value_node_init(
      open_quote,
      children,
      close_quote,
      false,
      start_location,
      parser->current_token->start
    );
  }
}

static AST_HTML_ATTRIBUTE_NODE_T* parser_parse_html_attribute(parser_T* parser, array_T* array, AST_NODE_T* element) {
  AST_HTML_ATTRIBUTE_NAME_NODE_T* attribute_name = parser_parse_html_attribute_name(parser, element);

  if (parser->current_token->type == TOKEN_EQUALS) {
    token_T* equals = parser_consume(parser, TOKEN_EQUALS, element->errors);
    AST_HTML_ATTRIBUTE_VALUE_NODE_T* attribute_value = parser_parse_html_attribute_value(parser, element);

    return ast_html_attribute_node_init(
      attribute_name,
      equals,
      attribute_value,
      attribute_name->base.start,
      attribute_value->base.end
    );
  }

  return ast_html_attribute_node_init(attribute_name, NULL, NULL, attribute_name->base.start, attribute_name->base.end);
}

static AST_HTML_OPEN_TAG_NODE_T* parser_parse_html_open_tag(parser_T* parser, AST_HTML_ELEMENT_NODE_T* element) {
  token_T* tag_start = parser_consume(parser, TOKEN_HTML_TAG_START, element->base.errors);
  token_T* tag_name = parser_consume(parser, TOKEN_IDENTIFIER, element->base.errors);

  array_T* children = array_init(8);
  array_T* attributes = array_init(8);

  while (parser->current_token->type != TOKEN_HTML_TAG_END && parser->current_token->type != TOKEN_HTML_TAG_SELF_CLOSE
         && parser->current_token->type != TOKEN_EOF) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START: parser_parse_erb_tag(parser, (AST_NODE_T*) element); break;
      case TOKEN_WHITESPACE: parser_consume(parser, TOKEN_WHITESPACE, element->base.errors); break;
      case TOKEN_IDENTIFIER: {
        AST_HTML_ATTRIBUTE_NODE_T* attribute = parser_parse_html_attribute(parser, attributes, (AST_NODE_T*) element);

        array_append(attributes, attribute);
      } break;

      default: {
        AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node =
          parser_append_unexpected_token_from_token(parser, parser->current_token->type, (AST_NODE_T*) element);
        array_append(children, unexpected_token_node);
        break;
      }
    }
  }

  if (parser->current_token->type == TOKEN_HTML_TAG_END) {
    token_T* tag_end = parser_consume(parser, TOKEN_HTML_TAG_END, element->base.errors);

    return ast_html_open_tag_node_init(
      tag_start,
      tag_name,
      attributes,
      tag_end,
      children,
      false,
      tag_start->start,
      tag_end->end
    );
  } else if (parser->current_token->type == TOKEN_HTML_TAG_SELF_CLOSE) {
    token_T* tag_end = parser_consume(parser, TOKEN_HTML_TAG_SELF_CLOSE, element->base.errors);

    return ast_html_open_tag_node_init(
      tag_start,
      tag_name,
      attributes,
      tag_end,
      children,
      true,
      tag_start->start,
      tag_end->end
    );
  } else {
    parser_append_unexpected_token_from_token(parser, parser->current_token->type, (AST_NODE_T*) element);

    return NULL;
  }
}

static AST_HTML_CLOSE_TAG_NODE_T* parser_parse_html_close_tag(parser_T* parser, AST_HTML_ELEMENT_NODE_T* element) {
  token_T* tag_opening = parser_consume(parser, TOKEN_HTML_TAG_START_CLOSE, element->base.errors);
  token_T* tag_name = parser_consume(parser, TOKEN_IDENTIFIER, element->base.errors);
  token_T* tag_closing = parser_consume(parser, TOKEN_HTML_TAG_END, element->base.errors);

  return ast_html_close_tag_node_init(tag_opening, tag_name, tag_closing, tag_opening->start, tag_closing->end);
}

static AST_HTML_ELEMENT_NODE_T* parser_parse_html_element(parser_T* parser, AST_NODE_T* parent) {
  AST_HTML_OPEN_TAG_NODE_T* open_tag = parser_parse_html_open_tag(parser, (AST_HTML_ELEMENT_NODE_T*) parent);

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
      open_tag->base.end
    );

  } else if (open_tag->base.type == AST_HTML_OPEN_TAG_NODE) {
    array_T* body = array_init(8);

    // open_tag isn't right here
    parser_parse_in_data_state(parser, (AST_NODE_T*) open_tag, body);

    AST_HTML_CLOSE_TAG_NODE_T* close_tag = parser_parse_html_close_tag(parser, (AST_HTML_ELEMENT_NODE_T*) parent);

    AST_HTML_ELEMENT_NODE_T* element_node = ast_html_element_node_init(
      open_tag,
      open_tag->tag_name,
      body,
      close_tag,
      false,
      open_tag->base.start,
      close_tag->base.end
    );

    if (strcasecmp(open_tag->tag_name->value, close_tag->tag_name->value) != 0) {
      AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = parser_unexpected_token(
        close_tag->base.start,
        close_tag->base.end,
        "mismatched closing tag",
        open_tag->tag_name->value,
        close_tag->tag_name->value
      );

      array_append(element_node->base.errors, unexpected_token_node);
    }

    return element_node;
  } else {
    AST_HTML_ELEMENT_NODE_T* element_node = ast_html_element_node_init(
      open_tag,
      open_tag->tag_name,
      NULL,
      NULL,
      false,
      open_tag->base.start,
      open_tag->base.end
    );

    AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node = parser_unexpected_token(
      open_tag->base.start,
      open_tag->base.end,
      "open_tag type",
      "AST_HTML_OPEN_TAG_NODE, AST_HTML_SELF_CLOSE_TAG_NODE",
      open_tag->tag_name->value
    );

    array_append(element_node->body, unexpected_token_node);

    return element_node;
  }
}

static AST_ERB_CONTENT_NODE_T* parser_parse_erb_tag(parser_T* parser, AST_NODE_T* element) {
  token_T* opening_tag = parser_consume(parser, TOKEN_ERB_START, element->errors);
  token_T* content = parser_consume(parser, TOKEN_ERB_CONTENT, element->errors);
  token_T* closing_tag = parser_consume(parser, TOKEN_ERB_END, element->errors);

  return ast_erb_content_node_init(opening_tag, content, closing_tag, opening_tag->start, closing_tag->end);
}

static array_T* parser_parse_in_data_state(parser_T* parser, AST_NODE_T* element, array_T* children) {
  while (parser->current_token->type != TOKEN_EOF && parser->current_token->type != TOKEN_HTML_TAG_START_CLOSE) {
    switch (parser->current_token->type) {
      case TOKEN_ERB_START: {
        AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser, element);
        array_append(children, erb_node);
        break;
      }

      case TOKEN_HTML_DOCTYPE: {
        AST_HTML_DOCTYPE_NODE_T* doctype_node = parser_parse_html_doctype(parser, element);
        array_append(children, doctype_node);
        break;
      }

      case TOKEN_HTML_COMMENT_START: {
        AST_HTML_COMMENT_NODE_T* comment = parser_parse_html_comment(parser, element);
        array_append(children, comment);
        break;
      }

      case TOKEN_HTML_TAG_START: {
        AST_HTML_ELEMENT_NODE_T* element_node = parser_parse_html_element(parser, element);
        array_append(children, element_node);
        break;
      }

      case TOKEN_IDENTIFIER:
      case TOKEN_WHITESPACE:
      case TOKEN_NEWLINE: {
        AST_HTML_TEXT_NODE_T* text_node = parser_parse_text_content(parser, element);
        array_append(children, text_node);

        break;
      }

      case TOKEN_HTML_TAG_START_CLOSE:
      case TOKEN_EOF: {
        break;
      }

      default: {
        AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token_node =
          parser_append_unexpected_token_from_token(parser, parser->current_token->type, element);
        array_append(children, unexpected_token_node);
      } break;
    }
  }

  return children;
}

static AST_DOCUMENT_NODE_T* parser_parse_document(parser_T* parser) {
  array_T* children = array_init(8);
  AST_DOCUMENT_NODE_T* document_node =
    ast_document_node_init(children, parser->current_token->start, parser->current_token->start);

  parser_parse_in_data_state(parser, &document_node->base, document_node->children);

  token_T* eof = parser_consume(parser, TOKEN_EOF, document_node->base.errors);
  ast_node_set_end(&document_node->base, eof->end);

  return document_node;
}

AST_DOCUMENT_NODE_T* parser_parse(parser_T* parser) {
  return parser_parse_document(parser);
}
