#include "include/parser.h"
#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/errors.h"
#include "include/html_util.h"
#include "include/lexer.h"
#include "include/lexer_peek_helpers.h"
#include "include/parser_helpers.h"
#include "include/token.h"
#include "include/token_matchers.h"
#include "include/util.h"
#include "include/util/hb_array.h"
#include "include/util/hb_buffer.h"
#include "include/util/hb_string.h"
#include "include/util/string.h"
#include "include/visitor.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

#define MAX_CONSECUTIVE_ERRORS 10

static void parser_parse_in_data_state(parser_T* parser, hb_array_T* children, hb_array_T* errors);
static void parser_parse_foreign_content(parser_T* parser, hb_array_T* children, hb_array_T* errors);
static AST_ERB_CONTENT_NODE_T* parser_parse_erb_tag(parser_T* parser);
static void parser_handle_whitespace(parser_T* parser, token_T* whitespace_token, hb_array_T* children);
static void parser_consume_whitespace(parser_T* parser, hb_array_T* children);
static void parser_skip_erb_content(lexer_T* lexer);
static bool parser_lookahead_erb_is_attribute(lexer_T* lexer);
static bool parser_lookahead_erb_is_control_flow(parser_T* parser);
static void parser_handle_erb_in_open_tag(parser_T* parser, hb_array_T* children);
static void parser_handle_whitespace_in_open_tag(parser_T* parser, hb_array_T* children);

const parser_options_T HERB_DEFAULT_PARSER_OPTIONS = { .track_whitespace = false,
                                                       .analyze = true,
                                                       .strict = true,
                                                       .action_view_helpers = false,
                                                       .prism_nodes_deep = false,
                                                       .prism_nodes = false,
                                                       .prism_program = false };

size_t parser_sizeof(void) {
  return sizeof(struct PARSER_STRUCT);
}

void herb_parser_init(parser_T* parser, lexer_T* lexer, parser_options_T options) {
  parser->allocator = lexer->allocator;
  parser->lexer = lexer;
  parser->current_token = lexer_next_token(lexer);
  parser->open_tags_stack = hb_array_init(16, parser->allocator);
  parser->state = PARSER_STATE_DATA;
  parser->foreign_content_type = FOREIGN_CONTENT_UNKNOWN;
  parser->options = options;
  parser->consecutive_error_count = 0;
  parser->in_recovery_mode = false;
}

static AST_CDATA_NODE_T* parser_parse_cdata(parser_T* parser) {
  hb_array_T* errors = hb_array_init(8, parser->allocator);
  hb_array_T* children = hb_array_init(8, parser->allocator);
  hb_buffer_T content;
  hb_buffer_init(&content, 128, parser->allocator);

  token_T* tag_opening = parser_consume_expected(parser, TOKEN_CDATA_START, errors);
  position_T start = parser->current_token->location.start;

  while (token_is_none_of(parser, TOKEN_CDATA_END, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &content, children, start);
      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      hb_array_append(children, erb_node);
      start = parser->current_token->location.start;
      continue;
    }

    token_T* token = parser_advance(parser);
    hb_buffer_append_string(&content, token->value);
    token_free(token, parser->allocator);
  }

  parser_append_literal_node_from_buffer(parser, &content, children, start);
  token_T* tag_closing = parser_consume_expected(parser, TOKEN_CDATA_END, errors);

  AST_CDATA_NODE_T* cdata = ast_cdata_node_init(
    tag_opening,
    children,
    tag_closing,
    tag_opening->location.start,
    tag_closing->location.end,
    errors,
    parser->allocator
  );

  hb_buffer_free(&content);
  token_free(tag_opening, parser->allocator);
  token_free(tag_closing, parser->allocator);

  return cdata;
}

static AST_HTML_COMMENT_NODE_T* parser_parse_html_comment(parser_T* parser) {
  hb_array_T* errors = hb_array_init(8, parser->allocator);
  hb_array_T* children = hb_array_init(8, parser->allocator);
  token_T* comment_start = parser_consume_expected(parser, TOKEN_HTML_COMMENT_START, errors);
  position_T start = parser->current_token->location.start;

  hb_buffer_T comment;
  hb_buffer_init(&comment, 512, parser->allocator);

  while (token_is_none_of(parser, TOKEN_HTML_COMMENT_END, TOKEN_HTML_COMMENT_INVALID_END, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &comment, children, start);

      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      hb_array_append(children, erb_node);

      start = parser->current_token->location.start;

      continue;
    }

    token_T* token = parser_advance(parser);
    hb_buffer_append_string(&comment, token->value);
    token_free(token, parser->allocator);
  }

  parser_append_literal_node_from_buffer(parser, &comment, children, start);

  token_T* comment_end = NULL;

  if (token_is(parser, TOKEN_HTML_COMMENT_INVALID_END)) {
    comment_end = parser_advance(parser);
    append_invalid_comment_closing_tag_error(
      comment_end,
      comment_end->location.start,
      comment_end->location.end,
      parser->allocator,
      errors
    );
  } else {
    comment_end = parser_consume_expected(parser, TOKEN_HTML_COMMENT_END, errors);
  }

  AST_HTML_COMMENT_NODE_T* comment_node = ast_html_comment_node_init(
    comment_start,
    children,
    comment_end,
    comment_start->location.start,
    comment_end->location.end,
    errors,
    parser->allocator
  );

  hb_buffer_free(&comment);
  token_free(comment_start, parser->allocator);
  token_free(comment_end, parser->allocator);

  return comment_node;
}

static AST_HTML_DOCTYPE_NODE_T* parser_parse_html_doctype(parser_T* parser) {
  hb_array_T* errors = hb_array_init(8, parser->allocator);
  hb_array_T* children = hb_array_init(8, parser->allocator);
  hb_buffer_T content;
  hb_buffer_init(&content, 64, parser->allocator);

  token_T* tag_opening = parser_consume_expected(parser, TOKEN_HTML_DOCTYPE, errors);

  position_T start = parser->current_token->location.start;

  while (token_is_none_of(parser, TOKEN_HTML_TAG_END, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &content, children, start);

      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      hb_array_append(children, erb_node);

      continue;
    }

    token_T* token = parser_consume_expected(parser, parser->current_token->type, errors);
    hb_buffer_append_string(&content, token->value);
    token_free(token, parser->allocator);
  }

  parser_append_literal_node_from_buffer(parser, &content, children, start);

  token_T* tag_closing = parser_consume_expected(parser, TOKEN_HTML_TAG_END, errors);

  AST_HTML_DOCTYPE_NODE_T* doctype = ast_html_doctype_node_init(
    tag_opening,
    children,
    tag_closing,
    tag_opening->location.start,
    tag_closing->location.end,
    errors,
    parser->allocator
  );

  token_free(tag_opening, parser->allocator);
  token_free(tag_closing, parser->allocator);
  hb_buffer_free(&content);

  return doctype;
}

static AST_XML_DECLARATION_NODE_T* parser_parse_xml_declaration(parser_T* parser) {
  hb_array_T* errors = hb_array_init(8, parser->allocator);
  hb_array_T* children = hb_array_init(8, parser->allocator);
  hb_buffer_T content;
  hb_buffer_init(&content, 64, parser->allocator);

  token_T* tag_opening = parser_consume_expected(parser, TOKEN_XML_DECLARATION, errors);

  position_T start = parser->current_token->location.start;

  while (token_is_none_of(parser, TOKEN_XML_DECLARATION_END, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &content, children, start);

      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      hb_array_append(children, erb_node);

      start = parser->current_token->location.start;

      continue;
    }

    token_T* token = parser_advance(parser);
    hb_buffer_append_string(&content, token->value);
    token_free(token, parser->allocator);
  }

  parser_append_literal_node_from_buffer(parser, &content, children, start);

  token_T* tag_closing = parser_consume_expected(parser, TOKEN_XML_DECLARATION_END, errors);

  AST_XML_DECLARATION_NODE_T* xml_declaration = ast_xml_declaration_node_init(
    tag_opening,
    children,
    tag_closing,
    tag_opening->location.start,
    tag_closing->location.end,
    errors,
    parser->allocator
  );

  token_free(tag_opening, parser->allocator);
  token_free(tag_closing, parser->allocator);
  hb_buffer_free(&content);

  return xml_declaration;
}

static AST_HTML_TEXT_NODE_T* parser_parse_text_content(parser_T* parser, hb_array_T* document_errors) {
  position_T start = parser->current_token->location.start;

  hb_buffer_T content;
  hb_buffer_init(&content, 2048, parser->allocator);

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
      hb_buffer_free(&content);

      parser_append_unexpected_error_string(parser, document_errors, "Token Error", "not an error token");

      return NULL;
    }

    if (parser->options.strict && parser->current_token->type == TOKEN_PERCENT) {
      lexer_T lexer_copy = *parser->lexer;
      token_T* peek_token = lexer_next_token(&lexer_copy);

      if (peek_token && peek_token->type == TOKEN_HTML_TAG_END) {
        position_T stray_start = parser->current_token->location.start;
        position_T stray_end = peek_token->location.end;
        token_free(peek_token, parser->allocator);

        append_stray_erb_closing_tag_error(stray_start, stray_end, parser->allocator, document_errors);

        token_T* percent = parser_advance(parser);
        hb_buffer_append_string(&content, percent->value);
        token_free(percent, parser->allocator);

        token_T* gt = parser_advance(parser);
        hb_buffer_append_string(&content, gt->value);
        token_free(gt, parser->allocator);

        continue;
      }

      token_free(peek_token, parser->allocator);
    }

    token_T* token = parser_advance(parser);
    hb_buffer_append_string(&content, token->value);
    token_free(token, parser->allocator);
  }

  hb_array_T* errors = hb_array_init(8, parser->allocator);

  AST_HTML_TEXT_NODE_T* text_node = NULL;

  if (hb_buffer_length(&content) > 0) {
    hb_string_T text_content = { .data = content.value, .length = (uint32_t) content.length };
    text_node =
      ast_html_text_node_init(text_content, start, parser->current_token->location.start, errors, parser->allocator);
  } else {
    text_node =
      ast_html_text_node_init(HB_STRING_EMPTY, start, parser->current_token->location.start, errors, parser->allocator);
  }

  hb_buffer_free(&content);

  return text_node;
}

static AST_HTML_ATTRIBUTE_NAME_NODE_T* parser_parse_html_attribute_name(parser_T* parser) {
  hb_array_T* errors = hb_array_init(8, parser->allocator);
  hb_array_T* children = hb_array_init(8, parser->allocator);
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 128, parser->allocator);
  position_T start = parser->current_token->location.start;

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
      hb_string_T tag = parser->current_token->value;
      bool is_output_tag = (tag.length >= 3 && tag.data[2] == '=');

      if (!is_output_tag) {
        bool is_control_flow = parser_lookahead_erb_is_control_flow(parser);

        if (hb_buffer_is_empty(&buffer) && hb_array_size(children) == 0) { break; }
        if (is_control_flow) { break; }
      }

      parser_append_literal_node_from_buffer(parser, &buffer, children, start);

      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      hb_array_append(children, erb_node);

      start = parser->current_token->location.start;
      continue;
    }

    token_T* token = parser_advance(parser);
    hb_buffer_append_string(&buffer, token->value);
    token_free(token, parser->allocator);
  }

  parser_append_literal_node_from_buffer(parser, &buffer, children, start);

  position_T node_start = { 0 };
  position_T node_end = { 0 };

  if (hb_array_size(children) > 0) {
    AST_NODE_T* first_child = hb_array_first(children);
    AST_NODE_T* last_child = hb_array_last(children);

    node_start = first_child->location.start;
    node_end = last_child->location.end;
  } else {
    node_start = parser->current_token->location.start;
    node_end = parser->current_token->location.start;
  }

  AST_HTML_ATTRIBUTE_NAME_NODE_T* attribute_name =
    ast_html_attribute_name_node_init(children, node_start, node_end, errors, parser->allocator);

  hb_buffer_free(&buffer);

  return attribute_name;
}

static AST_HTML_ATTRIBUTE_VALUE_NODE_T* parser_parse_quoted_html_attribute_value(
  parser_T* parser,
  hb_array_T* children,
  hb_array_T* errors
) {
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 512, parser->allocator);
  token_T* opening_quote = parser_consume_expected(parser, TOKEN_QUOTE, errors);
  position_T start = parser->current_token->location.start;

  while (!token_is(parser, TOKEN_EOF)
         && !(
           token_is(parser, TOKEN_QUOTE) && opening_quote != NULL
           && hb_string_equals(parser->current_token->value, opening_quote->value)
         )) {
    if (token_is(parser, TOKEN_HTML_TAG_END) || token_is(parser, TOKEN_HTML_TAG_SELF_CLOSE)) {
      lexer_state_snapshot_T saved_state = lexer_save_state(parser->lexer);
      bool found_closing_quote = false;
      token_T* lookahead = lexer_next_token(parser->lexer);

      while (lookahead && lookahead->type != TOKEN_EOF) {
        if (lookahead->type == TOKEN_QUOTE && opening_quote != NULL
            && hb_string_equals(lookahead->value, opening_quote->value)) {
          found_closing_quote = true;
          token_free(lookahead, parser->allocator);
          break;
        }

        token_free(lookahead, parser->allocator);

        lookahead = lexer_next_token(parser->lexer);
      }

      if (lookahead && !found_closing_quote && lookahead->type == TOKEN_EOF) {
        token_free(lookahead, parser->allocator);
      }

      lexer_restore_state(parser->lexer, saved_state);

      if (found_closing_quote) {
        hb_buffer_append_string(&buffer, parser->current_token->value);
        token_free(parser->current_token, parser->allocator);
        parser->current_token = lexer_next_token(parser->lexer);
        continue;
      }

      append_unclosed_quote_error(
        opening_quote,
        opening_quote->location.start,
        parser->current_token->location.start,
        parser->allocator,
        errors
      );

      parser_append_literal_node_from_buffer(parser, &buffer, children, start);
      hb_buffer_free(&buffer);

      AST_HTML_ATTRIBUTE_VALUE_NODE_T* attribute_value = ast_html_attribute_value_node_init(
        opening_quote,
        children,
        NULL,
        true,
        opening_quote->location.start,
        parser->current_token->location.start,
        errors,
        parser->allocator
      );

      token_free(opening_quote, parser->allocator);

      return attribute_value;
    }

    bool buffer_ends_with_whitespace = buffer.length > 0 && is_whitespace(buffer.value[buffer.length - 1]);

    if (token_is(parser, TOKEN_IDENTIFIER) && buffer_ends_with_whitespace) {
      lexer_state_snapshot_T saved_state = lexer_save_state(parser->lexer);
      token_T* equals_token = lexer_next_token(parser->lexer);
      bool looks_like_new_attribute = false;

      if (equals_token && equals_token->type == TOKEN_EQUALS) {
        token_T* after_equals = lexer_next_token(parser->lexer);
        looks_like_new_attribute = (after_equals && after_equals->type == TOKEN_QUOTE);

        if (after_equals) { token_free(after_equals, parser->allocator); }
      }

      if (equals_token) { token_free(equals_token, parser->allocator); }
      lexer_restore_state(parser->lexer, saved_state);

      if (looks_like_new_attribute) {
        append_unclosed_quote_error(
          opening_quote,
          opening_quote->location.start,
          parser->current_token->location.start,
          parser->allocator,
          errors
        );

        parser_append_literal_node_from_buffer(parser, &buffer, children, start);
        hb_buffer_free(&buffer);

        AST_HTML_ATTRIBUTE_VALUE_NODE_T* attribute_value = ast_html_attribute_value_node_init(
          opening_quote,
          children,
          NULL,
          true,
          opening_quote->location.start,
          parser->current_token->location.start,
          errors,
          parser->allocator
        );

        token_free(opening_quote, parser->allocator);

        return attribute_value;
      }
    }

    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &buffer, children, start);

      hb_array_append(children, parser_parse_erb_tag(parser));

      start = parser->current_token->location.start;

      continue;
    }

    hb_buffer_append_string(&buffer, parser->current_token->value);
    token_free(parser->current_token, parser->allocator);

    parser->current_token = lexer_next_token(parser->lexer);
  }

  if (token_is(parser, TOKEN_QUOTE) && opening_quote != NULL
      && hb_string_equals(parser->current_token->value, opening_quote->value)) {
    lexer_state_snapshot_T saved_state = lexer_save_state(parser->lexer);

    token_T* potential_closing = parser->current_token;
    parser->current_token = lexer_next_token(parser->lexer);

    if (token_is(parser, TOKEN_IDENTIFIER) || token_is(parser, TOKEN_CHARACTER)) {
      append_unexpected_error(
        hb_string("Unescaped quote character in attribute value"),
        hb_string("HTML entity (&apos;/&quot;) or different quote style"),
        opening_quote->value,
        potential_closing->location.start,
        potential_closing->location.end,
        parser->allocator,
        errors
      );

      lexer_restore_state(parser->lexer, saved_state);

      token_free(parser->current_token, parser->allocator);
      parser->current_token = potential_closing;

      hb_buffer_append_string(&buffer, parser->current_token->value);
      token_free(parser->current_token, parser->allocator);
      parser->current_token = lexer_next_token(parser->lexer);

      while (!token_is(parser, TOKEN_EOF)
             && !(
               token_is(parser, TOKEN_QUOTE) && opening_quote != NULL
               && hb_string_equals(parser->current_token->value, opening_quote->value)
             )) {
        if (token_is(parser, TOKEN_ERB_START)) {
          parser_append_literal_node_from_buffer(parser, &buffer, children, start);

          hb_array_append(children, parser_parse_erb_tag(parser));

          start = parser->current_token->location.start;

          continue;
        }

        hb_buffer_append_string(&buffer, parser->current_token->value);
        token_free(parser->current_token, parser->allocator);

        parser->current_token = lexer_next_token(parser->lexer);
      }
    } else {
      token_free(parser->current_token, parser->allocator);
      parser->current_token = potential_closing;

      lexer_restore_state(parser->lexer, saved_state);
    }
  }

  parser_append_literal_node_from_buffer(parser, &buffer, children, start);
  hb_buffer_free(&buffer);

  token_T* closing_quote = parser_consume_expected(parser, TOKEN_QUOTE, errors);

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* attribute_value = ast_html_attribute_value_node_init(
    opening_quote,
    children,
    closing_quote,
    true,
    opening_quote->location.start,
    closing_quote->location.end,
    errors,
    parser->allocator
  );

  token_free(opening_quote, parser->allocator);
  token_free(closing_quote, parser->allocator);

  return attribute_value;
}

static AST_HTML_ATTRIBUTE_VALUE_NODE_T* parser_parse_html_attribute_value(parser_T* parser) {
  hb_array_T* children = hb_array_init(8, parser->allocator);
  hb_array_T* errors = hb_array_init(8, parser->allocator);

  // <div id=<%= "home" %>>
  if (token_is(parser, TOKEN_ERB_START)) {
    AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
    hb_array_append(children, erb_node);

    return ast_html_attribute_value_node_init(
      NULL,
      children,
      NULL,
      false,
      erb_node->base.location.start,
      erb_node->base.location.end,
      errors,
      parser->allocator
    );
  }

  // <div id=home>
  if (token_is(parser, TOKEN_IDENTIFIER)) {
    token_T* identifier = parser_consume_expected(parser, TOKEN_IDENTIFIER, errors);
    AST_LITERAL_NODE_T* literal = ast_literal_node_init_from_token(identifier, parser->allocator);
    token_free(identifier, parser->allocator);

    hb_array_append(children, literal);

    return ast_html_attribute_value_node_init(
      NULL,
      children,
      NULL,
      false,
      literal->base.location.start,
      literal->base.location.end,
      errors,
      parser->allocator
    );
  }

  // <div id="home">
  if (token_is(parser, TOKEN_QUOTE)) { return parser_parse_quoted_html_attribute_value(parser, children, errors); }

  if (token_is(parser, TOKEN_BACKTICK)) {
    token_T* token = parser_advance(parser);
    position_T start = token->location.start;
    position_T end = token->location.end;

    append_unexpected_error(
      hb_string("Invalid quote character for HTML attribute"),
      hb_string("single quote (') or double quote (\")"),
      hb_string("a backtick"),
      start,
      end,
      parser->allocator,
      errors
    );

    AST_HTML_ATTRIBUTE_VALUE_NODE_T* value =
      ast_html_attribute_value_node_init(NULL, children, NULL, false, start, end, errors, parser->allocator);

    token_free(token, parser->allocator);

    return value;
  }

  char* expected = token_types_to_friendly_string(parser->allocator, TOKEN_IDENTIFIER, TOKEN_QUOTE, TOKEN_ERB_START);

  append_unexpected_error(
    hb_string("Unexpected Token"),
    hb_string(expected),
    token_type_to_friendly_string(parser->current_token->type),
    parser->current_token->location.start,
    parser->current_token->location.end,
    parser->allocator,
    errors
  );

  hb_allocator_dealloc(parser->allocator, expected);

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value = ast_html_attribute_value_node_init(
    NULL,
    children,
    NULL,
    false,
    parser->current_token->location.start,
    parser->current_token->location.end,
    errors,
    parser->allocator
  );

  return value;
}

static AST_HTML_ATTRIBUTE_NODE_T* parser_parse_html_attribute(parser_T* parser) {
  AST_HTML_ATTRIBUTE_NAME_NODE_T* attribute_name = parser_parse_html_attribute_name(parser);

  if (parser->options.track_whitespace) {
    bool has_equals = (parser->current_token->type == TOKEN_EQUALS)
                   || lexer_peek_for_token_type_after_whitespace(parser->lexer, TOKEN_EQUALS);

    if (has_equals) {
      hb_buffer_T equals_buffer;
      hb_buffer_init(&equals_buffer, 256, parser->allocator);
      position_T equals_start = { 0 };
      position_T equals_end = { 0 };
      uint32_t range_start = 0;
      uint32_t range_end = 0;

      bool equals_start_present = false;
      while (token_is_any_of(parser, TOKEN_WHITESPACE, TOKEN_NEWLINE)) {
        token_T* whitespace = parser_advance(parser);

        if (equals_start_present == false) {
          equals_start_present = true;
          equals_start = whitespace->location.start;
          range_start = whitespace->range.from;
        }

        hb_buffer_append_string(&equals_buffer, whitespace->value);
        token_free(whitespace, parser->allocator);
      }

      token_T* equals = parser_advance(parser);

      if (equals_start_present == false) {
        equals_start_present = true;
        equals_start = equals->location.start;
        range_start = equals->range.from;
      }

      hb_buffer_append_string(&equals_buffer, equals->value);
      equals_end = equals->location.end;
      range_end = equals->range.to;
      token_free(equals, parser->allocator);

      while (token_is_any_of(parser, TOKEN_WHITESPACE, TOKEN_NEWLINE)) {
        token_T* whitespace = parser_advance(parser);
        hb_buffer_append_string(&equals_buffer, whitespace->value);
        equals_end = whitespace->location.end;
        range_end = whitespace->range.to;
        token_free(whitespace, parser->allocator);
      }

      token_T* equals_with_whitespace = hb_allocator_alloc(parser->allocator, sizeof(token_T));

      if (!equals_with_whitespace) {
        hb_buffer_free(&equals_buffer);

        return ast_html_attribute_node_init(
          attribute_name,
          NULL,
          NULL,
          attribute_name->base.location.start,
          attribute_name->base.location.end,
          NULL,
          parser->allocator
        );
      }

      equals_with_whitespace->type = TOKEN_EQUALS;

      char* arena_copy = hb_allocator_strndup(parser->allocator, equals_buffer.value, equals_buffer.length);
      equals_with_whitespace->value = (hb_string_T) { .data = arena_copy, .length = (uint32_t) equals_buffer.length };

      hb_buffer_free(&equals_buffer);

      equals_with_whitespace->location = (location_T) { .start = equals_start, .end = equals_end };
      equals_with_whitespace->range = (range_T) { .from = range_start, .to = range_end };

      AST_HTML_ATTRIBUTE_VALUE_NODE_T* attribute_value = parser_parse_html_attribute_value(parser);

      return ast_html_attribute_node_init(
        attribute_name,
        equals_with_whitespace,
        attribute_value,
        attribute_name->base.location.start,
        attribute_value->base.location.end,
        NULL,
        parser->allocator
      );
    } else {
      return ast_html_attribute_node_init(
        attribute_name,
        NULL,
        NULL,
        attribute_name->base.location.start,
        attribute_name->base.location.end,
        NULL,
        parser->allocator
      );
    }
  } else {
    parser_consume_whitespace(parser, NULL);
  }

  token_T* equals = parser_consume_if_present(parser, TOKEN_EQUALS);

  if (equals != NULL) {
    parser_consume_whitespace(parser, NULL);

    // <div class= >
    if (token_is(parser, TOKEN_HTML_TAG_END) || token_is(parser, TOKEN_HTML_TAG_SELF_CLOSE)) {
      hb_array_T* errors = hb_array_init(8, parser->allocator);
      hb_string_T attribute_name_string = hb_string("unknown");

      if (hb_array_size(attribute_name->children) > 0) {
        AST_LITERAL_NODE_T* first_child = (AST_LITERAL_NODE_T*) hb_array_get(attribute_name->children, 0);

        if (first_child && !hb_string_is_empty(first_child->content)) { attribute_name_string = first_child->content; }
      }

      append_missing_attribute_value_error(
        attribute_name_string,
        equals->location.start,
        parser->current_token->location.start,
        parser->allocator,
        errors
      );

      AST_HTML_ATTRIBUTE_VALUE_NODE_T* empty_value = ast_html_attribute_value_node_init(
        NULL,
        hb_array_init(8, parser->allocator),
        NULL,
        false,
        equals->location.end,
        parser->current_token->location.start,
        errors,
        parser->allocator
      );

      AST_HTML_ATTRIBUTE_NODE_T* attribute_node = ast_html_attribute_node_init(
        attribute_name,
        equals,
        empty_value,
        attribute_name->base.location.start,
        parser->current_token->location.start,
        NULL,
        parser->allocator
      );

      token_free(equals, parser->allocator);

      return attribute_node;
    }

    AST_HTML_ATTRIBUTE_VALUE_NODE_T* attribute_value = parser_parse_html_attribute_value(parser);

    AST_HTML_ATTRIBUTE_NODE_T* attribute_node = ast_html_attribute_node_init(
      attribute_name,
      equals,
      attribute_value,
      attribute_name->base.location.start,
      attribute_value->base.location.end,
      NULL,
      parser->allocator
    );

    token_free(equals, parser->allocator);

    return attribute_node;
  }

  return ast_html_attribute_node_init(
    attribute_name,
    NULL,
    NULL,
    attribute_name->base.location.start,
    attribute_name->base.location.end,
    NULL,
    parser->allocator
  );
}

static void parser_skip_erb_content(lexer_T* lexer) {
  token_T* token = NULL;

  do {
    token = lexer_next_token(lexer);

    if (token->type == TOKEN_ERB_END) {
      token_free(token, lexer->allocator);
      break;
    }

    token_free(token, lexer->allocator);
  } while (true);
}

static bool parser_lookahead_erb_is_attribute(lexer_T* lexer) {
  token_T* after = NULL;

  do {
    after = lexer_next_token(lexer);

    if (after->type == TOKEN_EQUALS) {
      token_free(after, lexer->allocator);
      return true;
    }

    if (after->type == TOKEN_WHITESPACE || after->type == TOKEN_NEWLINE) {
      token_free(after, lexer->allocator);
      continue;
    }

    if (after->type == TOKEN_IDENTIFIER || after->type == TOKEN_CHARACTER || after->type == TOKEN_DASH
        || after->type == TOKEN_ERB_START) {

      if (after->type == TOKEN_ERB_START) {
        token_free(after, lexer->allocator);
        parser_skip_erb_content(lexer);
      } else {
        token_free(after, lexer->allocator);
      }
      continue;
    }

    token_free(after, lexer->allocator);
    return false;

  } while (true);
}

static bool starts_with_keyword(hb_string_T string, const char* keyword) {
  hb_string_T prefix = hb_string(keyword);
  if (string.length < prefix.length) { return false; }
  if (strncmp(string.data, prefix.data, prefix.length) != 0) { return false; }

  if (string.length == prefix.length) { return true; }

  return is_whitespace(string.data[prefix.length]);
}

// TODO: ideally we could avoid basing this off of strings, and use the step in analyze.c
static bool parser_lookahead_erb_is_control_flow(parser_T* parser) {
  lexer_T lexer_copy = *parser->lexer;
  token_T* content = lexer_next_token(&lexer_copy);

  if (content == NULL || content->type != TOKEN_ERB_CONTENT) {
    if (content) { token_free(content, parser->allocator); }

    return false;
  }

  hb_string_T trimmed = hb_string_trim_start(content->value);

  bool is_control_flow = starts_with_keyword(trimmed, "end") || starts_with_keyword(trimmed, "else")
                      || starts_with_keyword(trimmed, "elsif") || starts_with_keyword(trimmed, "in")
                      || starts_with_keyword(trimmed, "when") || starts_with_keyword(trimmed, "rescue")
                      || starts_with_keyword(trimmed, "ensure");

  token_free(content, parser->allocator);

  return is_control_flow;
}

static void parser_handle_erb_in_open_tag(parser_T* parser, hb_array_T* children) {
  bool is_output_tag = !hb_string_is_empty(parser->current_token->value)
                    && hb_string_starts_with(parser->current_token->value, hb_string("<%="));

  if (!is_output_tag) {
    hb_array_append(children, parser_parse_erb_tag(parser));

    return;
  }

  lexer_T lexer_copy = *parser->lexer;

  token_T* erb_start = lexer_next_token(&lexer_copy);
  token_free(erb_start, parser->allocator);
  parser_skip_erb_content(&lexer_copy);

  bool looks_like_attribute = parser_lookahead_erb_is_attribute(&lexer_copy);

  if (looks_like_attribute) {
    hb_array_append(children, parser_parse_html_attribute(parser));
  } else {
    hb_array_append(children, parser_parse_erb_tag(parser));
  }
}

static void parser_handle_whitespace_in_open_tag(parser_T* parser, hb_array_T* children) {
  token_T* whitespace = parser_consume_if_present(parser, TOKEN_WHITESPACE);

  if (whitespace != NULL) {
    parser_handle_whitespace(parser, whitespace, children);
    return;
  }

  token_T* newline = parser_consume_if_present(parser, TOKEN_NEWLINE);

  if (newline != NULL) { parser_handle_whitespace(parser, newline, children); }
}

static AST_HTML_OPEN_TAG_NODE_T* parser_parse_html_open_tag(parser_T* parser) {
  hb_array_T* errors = hb_array_init(8, parser->allocator);
  hb_array_T* children = hb_array_init(8, parser->allocator);

  token_T* tag_start = parser_consume_expected(parser, TOKEN_HTML_TAG_START, errors);
  token_T* tag_name = parser_consume_expected(parser, TOKEN_IDENTIFIER, errors);

  while (token_is_none_of(parser, TOKEN_HTML_TAG_END, TOKEN_HTML_TAG_SELF_CLOSE, TOKEN_EOF)) {
    if (token_is_any_of(parser, TOKEN_HTML_TAG_START, TOKEN_HTML_TAG_START_CLOSE)) {
      append_unclosed_open_tag_error(
        tag_name,
        tag_name->location.start,
        parser->current_token->location.start,
        parser->allocator,
        errors
      );

      AST_HTML_OPEN_TAG_NODE_T* open_tag_node = ast_html_open_tag_node_init(
        tag_start,
        tag_name,
        NULL,
        children,
        false,
        tag_start->location.start,
        parser->current_token->location.start,
        errors,
        parser->allocator
      );

      token_free(tag_start, parser->allocator);
      token_free(tag_name, parser->allocator);

      return open_tag_node;
    }

    if (token_is_any_of(parser, TOKEN_WHITESPACE, TOKEN_NEWLINE)) {
      parser_handle_whitespace_in_open_tag(parser, children);
      continue;
    }

    if (parser->current_token->type == TOKEN_IDENTIFIER) {
      hb_array_append(children, parser_parse_html_attribute(parser));
      continue;
    }

    if (parser->current_token->type == TOKEN_ERB_START) {
      parser_handle_erb_in_open_tag(parser, children);
      continue;
    }

    if (parser->current_token->type == TOKEN_AT) {
      hb_array_append(children, parser_parse_html_attribute(parser));
      continue;
    }

    if (parser->current_token->type == TOKEN_COLON) {
      lexer_T lexer_copy = *parser->lexer;
      token_T* next_token = lexer_next_token(&lexer_copy);

      if (next_token && next_token->type == TOKEN_IDENTIFIER) {
        token_free(next_token, parser->allocator);
        hb_array_append(children, parser_parse_html_attribute(parser));

        continue;
      }

      token_free(next_token, parser->allocator);
    }

    if (parser->current_token->type == TOKEN_PERCENT) {
      lexer_T lexer_copy = *parser->lexer;
      token_T* peek_token = lexer_next_token(&lexer_copy);

      if (peek_token && peek_token->type == TOKEN_HTML_TAG_END) {
        position_T stray_start = parser->current_token->location.start;
        position_T stray_end = peek_token->location.end;
        token_free(peek_token, parser->allocator);

        append_stray_erb_closing_tag_error(stray_start, stray_end, parser->allocator, errors);

        token_T* percent = parser_advance(parser);
        token_T* gt = parser_advance(parser);

        AST_LITERAL_NODE_T* literal =
          ast_literal_node_init(hb_string("%>"), stray_start, stray_end, NULL, parser->allocator);
        hb_array_append(children, literal);

        token_free(percent, parser->allocator);
        token_free(gt, parser->allocator);

        continue;
      }

      token_free(peek_token, parser->allocator);
    }

    parser_append_unexpected_error(
      parser,
      errors,
      "Unexpected Token",
      TOKEN_IDENTIFIER,
      TOKEN_AT,
      TOKEN_ERB_START,
      TOKEN_WHITESPACE,
      TOKEN_NEWLINE
    );
  }

  if (token_is(parser, TOKEN_EOF)) {
    append_unclosed_open_tag_error(
      tag_name,
      tag_name->location.start,
      parser->current_token->location.start,
      parser->allocator,
      errors
    );

    AST_HTML_OPEN_TAG_NODE_T* open_tag_node = ast_html_open_tag_node_init(
      tag_start,
      tag_name,
      NULL,
      children,
      false,
      tag_start->location.start,
      parser->current_token->location.start,
      errors,
      parser->allocator
    );

    token_free(tag_start, parser->allocator);
    token_free(tag_name, parser->allocator);

    return open_tag_node;
  }

  bool is_self_closing = false;

  token_T* tag_end = parser_consume_if_present(parser, TOKEN_HTML_TAG_END);

  if (tag_end == NULL) {
    tag_end = parser_consume_expected(parser, TOKEN_HTML_TAG_SELF_CLOSE, errors);

    if (tag_end == NULL) {
      token_free(tag_start, parser->allocator);
      token_free(tag_name, parser->allocator);

      hb_array_free(&children);
      hb_array_free(&errors);

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
    tag_start->location.start,
    tag_end->location.end,
    errors,
    parser->allocator
  );

  token_free(tag_start, parser->allocator);
  token_free(tag_name, parser->allocator);
  token_free(tag_end, parser->allocator);

  return open_tag_node;
}

static AST_HTML_CLOSE_TAG_NODE_T* parser_parse_html_close_tag(parser_T* parser) {
  hb_array_T* errors = hb_array_init(8, parser->allocator);
  hb_array_T* children = hb_array_init(8, parser->allocator);

  token_T* tag_opening = parser_consume_expected(parser, TOKEN_HTML_TAG_START_CLOSE, errors);

  parser_consume_whitespace(parser, children);

  token_T* tag_name = parser_consume_expected(parser, TOKEN_IDENTIFIER, errors);

  parser_consume_whitespace(parser, children);

  token_T* tag_closing = parser_consume_if_present(parser, TOKEN_HTML_TAG_END);

  if (tag_closing == NULL) {
    append_unclosed_close_tag_error(
      tag_name,
      tag_opening->location.start,
      tag_name->location.end,
      parser->allocator,
      errors
    );
  }

  if (tag_closing != NULL && tag_name != NULL && is_void_element(tag_name->value)
      && parser_in_svg_context(parser) == false) {
    hb_string_T expected = html_self_closing_tag_string(tag_name->value, parser->allocator);
    hb_string_T got = html_closing_tag_string(tag_name->value, parser->allocator);

    append_void_element_closing_tag_error(
      tag_name,
      expected,
      got,
      tag_opening->location.start,
      tag_closing->location.end,
      parser->allocator,
      errors
    );

    hb_allocator_dealloc(parser->allocator, expected.data);
    hb_allocator_dealloc(parser->allocator, got.data);
  }

  position_T end_position = tag_closing != NULL ? tag_closing->location.end : tag_name->location.end;

  AST_HTML_CLOSE_TAG_NODE_T* close_tag = ast_html_close_tag_node_init(
    tag_opening,
    tag_name,
    children,
    tag_closing,
    tag_opening->location.start,
    end_position,
    errors,
    parser->allocator
  );

  token_free(tag_opening, parser->allocator);
  token_free(tag_name, parser->allocator);
  token_free(tag_closing, parser->allocator);

  return close_tag;
}

// TODO: this should probably be AST_HTML_ELEMENT_NODE_T with a AST_HTML_SELF_CLOSING_TAG_NODE_T
static AST_HTML_ELEMENT_NODE_T* parser_parse_html_self_closing_element(
  const parser_T* parser,
  AST_HTML_OPEN_TAG_NODE_T* open_tag
) {
  return ast_html_element_node_init(
    (AST_NODE_T*) open_tag,
    open_tag->tag_name,
    NULL,
    NULL,
    true,
    ELEMENT_SOURCE_HTML,
    open_tag->base.location.start,
    open_tag->base.location.end,
    NULL,
    parser->allocator
  );
}

static AST_HTML_ELEMENT_NODE_T* parser_parse_html_regular_element(
  parser_T* parser,
  AST_HTML_OPEN_TAG_NODE_T* open_tag
) {
  hb_array_T* errors = hb_array_init(8, parser->allocator);
  hb_array_T* body = hb_array_init(8, parser->allocator);

  parser_push_open_tag(parser, open_tag->tag_name);

  if (!hb_string_is_empty(open_tag->tag_name->value) && parser_is_foreign_content_tag(open_tag->tag_name->value)) {
    foreign_content_type_T content_type = parser_get_foreign_content_type(open_tag->tag_name->value);
    parser_enter_foreign_content(parser, content_type);
    parser_parse_foreign_content(parser, body, errors);
  } else {
    parser_parse_in_data_state(parser, body, errors);
  }

  if (!token_is(parser, TOKEN_HTML_TAG_START_CLOSE)) {
    return parser_handle_missing_close_tag(parser, open_tag, body, errors);
  }

  AST_HTML_CLOSE_TAG_NODE_T* close_tag = parser_parse_html_close_tag(parser);

  if (parser_in_svg_context(parser) == false && is_void_element(close_tag->tag_name->value)) {
    hb_array_push(body, close_tag);
    parser_parse_in_data_state(parser, body, errors);
    close_tag = parser_parse_html_close_tag(parser);
  }

  bool matches_stack = parser_check_matching_tag(parser, close_tag->tag_name->value);

  if (matches_stack) {
    token_T* popped_token = parser_pop_open_tag(parser);
    token_free(popped_token, parser->allocator);
  } else if (parser_can_close_ancestor(parser, close_tag->tag_name->value)) {
    size_t depth = parser_find_ancestor_depth(parser, close_tag->tag_name->value);

    for (size_t i = 0; i < depth; i++) {
      token_T* unclosed = parser_pop_open_tag(parser);

      if (unclosed != NULL) {
        append_missing_closing_tag_error(
          unclosed,
          unclosed->location.start,
          unclosed->location.end,
          parser->allocator,
          errors
        );
        token_free(unclosed, parser->allocator);
      }
    }

    token_T* popped_token = parser_pop_open_tag(parser);
    token_free(popped_token, parser->allocator);
  } else {
    parser_handle_mismatched_tags(parser, close_tag, errors);
  }

  return ast_html_element_node_init(
    (AST_NODE_T*) open_tag,
    open_tag->tag_name,
    body,
    (AST_NODE_T*) close_tag,
    false,
    ELEMENT_SOURCE_HTML,
    open_tag->base.location.start,
    close_tag->base.location.end,
    errors,
    parser->allocator
  );
}

static AST_NODE_T* parser_parse_html_element(parser_T* parser) {
  AST_HTML_OPEN_TAG_NODE_T* open_tag = parser_parse_html_open_tag(parser);

  if (open_tag->tag_closing == NULL) { return (AST_NODE_T*) open_tag; }

  // <tag />
  if (open_tag->is_void) { return (AST_NODE_T*) parser_parse_html_self_closing_element(parser, open_tag); }

  // <tag>, in void element list, and not in inside an <svg> element
  if (!open_tag->is_void && is_void_element(open_tag->tag_name->value) && !parser_in_svg_context(parser)) {
    return (AST_NODE_T*) parser_parse_html_self_closing_element(parser, open_tag);
  }

  if (!hb_string_is_empty(open_tag->tag_name->value) && parser_is_foreign_content_tag(open_tag->tag_name->value)) {
    AST_HTML_ELEMENT_NODE_T* regular_element = parser_parse_html_regular_element(parser, open_tag);

    if (regular_element != NULL) { return (AST_NODE_T*) regular_element; }
  }

  return (AST_NODE_T*) open_tag;
}

static AST_ERB_CONTENT_NODE_T* parser_parse_erb_tag(parser_T* parser) {
  hb_array_T* errors = hb_array_init(8, parser->allocator);

  token_T* opening_tag = parser_consume_expected(parser, TOKEN_ERB_START, errors);
  token_T* content = parser_consume_expected(parser, TOKEN_ERB_CONTENT, errors);

  token_T* closing_tag = NULL;
  position_T end_position;

  if (token_is(parser, TOKEN_ERB_END)) {
    closing_tag = parser_consume_expected(parser, TOKEN_ERB_END, errors);
    end_position = closing_tag->location.end;
  } else if (token_is(parser, TOKEN_ERB_START)) {
    append_nested_erb_tag_error(
      opening_tag,
      parser->current_token->location.start.line,
      parser->current_token->location.start.column,
      parser->current_token->location.start,
      parser->current_token->location.end,
      parser->allocator,
      errors
    );
    end_position = parser->current_token->location.start;
  } else {
    append_unclosed_erb_tag_error(
      opening_tag,
      opening_tag->location.start,
      parser->current_token->location.start,
      parser->allocator,
      errors
    );
    end_position = parser->current_token->location.start;
  }

  AST_ERB_CONTENT_NODE_T* erb_node = ast_erb_content_node_init(
    opening_tag,
    content,
    closing_tag,
    NULL,
    false,
    false,
    HERB_PRISM_NODE_EMPTY,
    opening_tag->location.start,
    end_position,
    errors,
    parser->allocator
  );

  token_free(opening_tag, parser->allocator);
  token_free(content, parser->allocator);
  if (closing_tag != NULL) { token_free(closing_tag, parser->allocator); }

  return erb_node;
}

static void parser_parse_foreign_content(parser_T* parser, hb_array_T* children, hb_array_T* errors) {
  hb_buffer_T content;
  hb_buffer_init(&content, 1024, parser->allocator);
  position_T start = parser->current_token->location.start;
  hb_string_T expected_closing_tag = parser_get_foreign_content_closing_tag(parser->foreign_content_type);

  if (hb_string_is_empty(expected_closing_tag)) {
    parser_exit_foreign_content(parser);
    hb_buffer_free(&content);

    return;
  }

  while (!token_is(parser, TOKEN_EOF)) {
    if (token_is(parser, TOKEN_ERB_START)) {
      parser_append_literal_node_from_buffer(parser, &content, children, start);

      AST_ERB_CONTENT_NODE_T* erb_node = parser_parse_erb_tag(parser);
      hb_array_append(children, erb_node);

      start = parser->current_token->location.start;

      continue;
    }

    if (token_is(parser, TOKEN_HTML_TAG_START_CLOSE)) {
      lexer_state_snapshot_T saved_state = lexer_save_state(parser->lexer);

      token_T* next_token = lexer_next_token(parser->lexer);
      bool is_potential_match = false;

      if (next_token && next_token->type == TOKEN_IDENTIFIER && !hb_string_is_empty(next_token->value)) {
        is_potential_match = parser_is_expected_closing_tag_name(next_token->value, parser->foreign_content_type);
      }

      lexer_restore_state(parser->lexer, saved_state);

      if (next_token) { token_free(next_token, parser->allocator); }

      if (is_potential_match) {
        parser_append_literal_node_from_buffer(parser, &content, children, start);
        parser_exit_foreign_content(parser);

        hb_buffer_free(&content);

        return;
      }
    }

    token_T* token = parser_advance(parser);
    hb_buffer_append_string(&content, token->value);
    token_free(token, parser->allocator);
  }

  parser_append_literal_node_from_buffer(parser, &content, children, start);
  parser_exit_foreign_content(parser);
  hb_buffer_free(&content);
}

static void parser_parse_in_data_state(parser_T* parser, hb_array_T* children, hb_array_T* errors) {
  while (token_is_not(parser, TOKEN_EOF)) {

    if (token_is(parser, TOKEN_ERB_START)) {
      hb_array_append(children, parser_parse_erb_tag(parser));
      parser->consecutive_error_count = 0;
      continue;
    }

    if (token_is(parser, TOKEN_HTML_DOCTYPE)) {
      hb_array_append(children, parser_parse_html_doctype(parser));
      parser->consecutive_error_count = 0;
      continue;
    }

    if (token_is(parser, TOKEN_XML_DECLARATION)) {
      hb_array_append(children, parser_parse_xml_declaration(parser));
      parser->consecutive_error_count = 0;
      continue;
    }

    if (token_is(parser, TOKEN_CDATA_START)) {
      hb_array_append(children, parser_parse_cdata(parser));
      parser->consecutive_error_count = 0;
      continue;
    }

    if (token_is(parser, TOKEN_HTML_COMMENT_START)) {
      hb_array_append(children, parser_parse_html_comment(parser));
      parser->consecutive_error_count = 0;
      continue;
    }

    if (token_is(parser, TOKEN_HTML_TAG_START)) {
      hb_array_append(children, parser_parse_html_element(parser));
      parser->consecutive_error_count = 0;
      continue;
    }

    if (token_is(parser, TOKEN_HTML_TAG_START_CLOSE)) {
      hb_array_append(children, parser_parse_html_close_tag(parser));
      parser->consecutive_error_count = 0;
      continue;
    }

    if (token_is_any_of(
          parser,
          TOKEN_AMPERSAND,
          TOKEN_AT,
          TOKEN_BACKSLASH,
          TOKEN_BACKTICK,
          TOKEN_CHARACTER,
          TOKEN_COLON,
          TOKEN_DASH,
          TOKEN_EQUALS,
          TOKEN_EXCLAMATION,
          TOKEN_HTML_TAG_END,
          TOKEN_IDENTIFIER,
          TOKEN_LT,
          TOKEN_NBSP,
          TOKEN_NEWLINE,
          TOKEN_PERCENT,
          TOKEN_QUOTE,
          TOKEN_SEMICOLON,
          TOKEN_SLASH,
          TOKEN_UNDERSCORE,
          TOKEN_WHITESPACE
        )) {
      hb_array_append(children, parser_parse_text_content(parser, errors));
      parser->consecutive_error_count = 0;
      continue;
    }

    parser->consecutive_error_count++;

    if (parser->consecutive_error_count >= MAX_CONSECUTIVE_ERRORS) {
      parser->in_recovery_mode = true;
      parser_synchronize(parser, errors);
      parser->consecutive_error_count = 0;
      continue;
    }

    parser_append_unexpected_error(
      parser,
      errors,
      "Unexpected token",
      TOKEN_ERB_START,
      TOKEN_HTML_DOCTYPE,
      TOKEN_HTML_COMMENT_START,
      TOKEN_IDENTIFIER,
      TOKEN_WHITESPACE,
      TOKEN_NBSP,
      TOKEN_AT,
      TOKEN_BACKSLASH,
      TOKEN_NEWLINE
    );

    parser_synchronize(parser, errors);
  }
}

static size_t find_matching_close_tag(hb_array_T* nodes, size_t start_idx, hb_string_T tag_name) {
  int depth = 0;

  for (size_t i = start_idx + 1; i < hb_array_size(nodes); i++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(nodes, i);
    if (node == NULL) { continue; }

    if (node->type == AST_HTML_OPEN_TAG_NODE) {
      AST_HTML_OPEN_TAG_NODE_T* open = (AST_HTML_OPEN_TAG_NODE_T*) node;

      if (hb_string_equals_case_insensitive(open->tag_name->value, tag_name)) { depth++; }
    } else if (node->type == AST_HTML_CLOSE_TAG_NODE) {
      AST_HTML_CLOSE_TAG_NODE_T* close = (AST_HTML_CLOSE_TAG_NODE_T*) node;

      if (hb_string_equals_case_insensitive(close->tag_name->value, tag_name)) {
        if (depth == 0) { return i; }
        depth--;
      }
    }
  }

  return (size_t) -1;
}

static size_t find_implicit_close_index(hb_array_T* nodes, size_t start_idx, hb_string_T tag_name) {
  if (!has_optional_end_tag(tag_name)) { return (size_t) -1; }

  for (size_t i = start_idx + 1; i < hb_array_size(nodes); i++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(nodes, i);
    if (node == NULL) { continue; }

    if (node->type == AST_HTML_OPEN_TAG_NODE) {
      AST_HTML_OPEN_TAG_NODE_T* open = (AST_HTML_OPEN_TAG_NODE_T*) node;
      hb_string_T next_tag_name = open->tag_name->value;

      if (should_implicitly_close(tag_name, next_tag_name)) { return i; }
    } else if (node->type == AST_HTML_CLOSE_TAG_NODE) {
      AST_HTML_CLOSE_TAG_NODE_T* close = (AST_HTML_CLOSE_TAG_NODE_T*) node;
      hb_string_T close_tag_name = close->tag_name->value;

      if (parent_closes_element(tag_name, close_tag_name)) { return i; }
    }
  }

  return hb_array_size(nodes);
}

static hb_array_T* parser_build_elements_from_tags(
  hb_array_T* nodes,
  hb_array_T* errors,
  const parser_options_T* options,
  hb_allocator_T* allocator
);

static hb_array_T* parser_build_elements_from_tags(
  hb_array_T* nodes,
  hb_array_T* errors,
  const parser_options_T* options,
  hb_allocator_T* allocator
) {
  bool strict = options ? options->strict : false;
  hb_array_T* result = hb_array_init(hb_array_size(nodes), allocator);

  for (size_t index = 0; index < hb_array_size(nodes); index++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(nodes, index);
    if (node == NULL) { continue; }

    if (node->type == AST_HTML_OPEN_TAG_NODE) {
      AST_HTML_OPEN_TAG_NODE_T* open_tag = (AST_HTML_OPEN_TAG_NODE_T*) node;
      hb_string_T tag_name = open_tag->tag_name->value;

      size_t close_index = find_matching_close_tag(nodes, index, tag_name);

      if (close_index == (size_t) -1) {
        size_t implicit_close_index = find_implicit_close_index(nodes, index, tag_name);

        if (implicit_close_index != (size_t) -1 && implicit_close_index > index + 1) {
          hb_array_T* body = hb_array_init(implicit_close_index - index - 1, allocator);

          for (size_t j = index + 1; j < implicit_close_index; j++) {
            hb_array_append(body, hb_array_get(nodes, j));
          }

          hb_array_T* processed_body = parser_build_elements_from_tags(body, errors, options, allocator);
          hb_array_free(&body);

          position_T end_position = open_tag->base.location.end;

          if (hb_array_size(processed_body) > 0) {
            AST_NODE_T* last_body_node = (AST_NODE_T*) hb_array_get(processed_body, hb_array_size(processed_body) - 1);
            if (last_body_node != NULL) { end_position = last_body_node->location.end; }
          }

          hb_array_T* element_errors = hb_array_init(8, allocator);

          if (strict) {
            append_omitted_closing_tag_error(
              open_tag->tag_name,
              end_position,
              open_tag->base.location.start,
              open_tag->base.location.end,
              allocator,
              element_errors
            );
          }

          AST_HTML_OMITTED_CLOSE_TAG_NODE_T* omitted_close_tag = ast_html_omitted_close_tag_node_init(
            open_tag->tag_name,
            end_position,
            end_position,
            hb_array_init(8, allocator),
            allocator
          );

          AST_HTML_ELEMENT_NODE_T* element = ast_html_element_node_init(
            (AST_NODE_T*) open_tag,
            open_tag->tag_name,
            processed_body,
            (AST_NODE_T*) omitted_close_tag,
            false,
            ELEMENT_SOURCE_HTML,
            open_tag->base.location.start,
            end_position,
            element_errors,
            allocator
          );

          hb_array_append(result, element);

          index = implicit_close_index - 1;
        } else {
          if (hb_array_size(open_tag->base.errors) == 0) {
            append_missing_closing_tag_error(
              open_tag->tag_name,
              open_tag->base.location.start,
              open_tag->base.location.end,
              allocator,
              open_tag->base.errors
            );
          }

          hb_array_append(result, node);
        }
      } else {
        AST_HTML_CLOSE_TAG_NODE_T* close_tag = (AST_HTML_CLOSE_TAG_NODE_T*) hb_array_get(nodes, close_index);

        hb_array_T* body = hb_array_init(close_index - index - 1, allocator);

        for (size_t j = index + 1; j < close_index; j++) {
          hb_array_append(body, hb_array_get(nodes, j));
        }

        hb_array_T* processed_body = parser_build_elements_from_tags(body, errors, options, allocator);
        hb_array_free(&body);

        hb_array_T* element_errors = hb_array_init(8, allocator);

        AST_HTML_ELEMENT_NODE_T* element = ast_html_element_node_init(
          (AST_NODE_T*) open_tag,
          open_tag->tag_name,
          processed_body,
          (AST_NODE_T*) close_tag,
          false,
          ELEMENT_SOURCE_HTML,
          open_tag->base.location.start,
          close_tag->base.location.end,
          element_errors,
          allocator
        );

        hb_array_append(result, element);

        index = close_index;
      }
    } else if (node->type == AST_HTML_CLOSE_TAG_NODE) {
      AST_HTML_CLOSE_TAG_NODE_T* close_tag = (AST_HTML_CLOSE_TAG_NODE_T*) node;

      if (!is_void_element(close_tag->tag_name->value)) {
        if (hb_array_size(close_tag->base.errors) == 0) {
          append_missing_opening_tag_error(
            close_tag->tag_name,
            close_tag->base.location.start,
            close_tag->base.location.end,
            allocator,
            close_tag->base.errors
          );
        }
      }

      hb_array_append(result, node);
    } else {
      hb_array_append(result, node);
    }
  }

  return result;
}

static AST_DOCUMENT_NODE_T* parser_parse_document(parser_T* parser) {
  hb_array_T* children = hb_array_init(8, parser->allocator);
  hb_array_T* errors = hb_array_init(8, parser->allocator);
  position_T start = parser->current_token->location.start;

  parser_parse_in_data_state(parser, children, errors);

  token_T* eof = parser_consume_expected(parser, TOKEN_EOF, errors);

  AST_DOCUMENT_NODE_T* document_node =
    ast_document_node_init(children, NULL, HERB_PRISM_NODE_EMPTY, start, eof->location.end, errors, parser->allocator);

  token_free(eof, parser->allocator);

  return document_node;
}

AST_DOCUMENT_NODE_T* herb_parser_parse(parser_T* parser) {
  return parser_parse_document(parser);
}

static void parser_handle_whitespace(parser_T* parser, token_T* whitespace_token, hb_array_T* children) {
  if (parser->options.track_whitespace) {
    hb_array_T* errors = hb_array_init(8, parser->allocator);
    AST_WHITESPACE_NODE_T* whitespace_node = ast_whitespace_node_init(
      whitespace_token,
      whitespace_token->location.start,
      whitespace_token->location.end,
      errors,
      parser->allocator
    );
    hb_array_append(children, whitespace_node);
  }

  token_free(whitespace_token, parser->allocator);
}

static void parser_consume_whitespace(parser_T* parser, hb_array_T* children) {
  while (token_is_any_of(parser, TOKEN_WHITESPACE, TOKEN_NEWLINE)) {
    token_T* whitespace = parser_advance(parser);

    if (parser->options.track_whitespace && children != NULL) {
      parser_handle_whitespace(parser, whitespace, children);
    } else {
      token_free(whitespace, parser->allocator);
    }
  }
}

void herb_parser_deinit(parser_T* parser) {
  if (parser == NULL) { return; }

  if (parser->current_token != NULL) { token_free(parser->current_token, parser->allocator); }

  if (parser->open_tags_stack != NULL) {
    for (size_t i = 0; i < hb_array_size(parser->open_tags_stack); i++) {
      token_T* token = (token_T*) hb_array_get(parser->open_tags_stack, i);
      if (token != NULL) { token_free(token, parser->allocator); }
    }

    hb_array_free(&parser->open_tags_stack);
  }
}

void match_tags_in_node_array(
  hb_array_T* nodes,
  hb_array_T* errors,
  const parser_options_T* options,
  hb_allocator_T* allocator
) {
  if (nodes == NULL || hb_array_size(nodes) == 0) { return; }

  hb_array_T* processed = parser_build_elements_from_tags(nodes, errors, options, allocator);

  nodes->size = 0;

  for (size_t i = 0; i < hb_array_size(processed); i++) {
    hb_array_append(nodes, hb_array_get(processed, i));
  }

  hb_array_free(&processed);

  match_tags_context_T context = { .errors = errors, .options = options, .allocator = allocator };

  for (size_t i = 0; i < hb_array_size(nodes); i++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(nodes, i);
    if (node == NULL) { continue; }

    herb_visit_node(node, match_tags_visitor, &context);
  }
}

void herb_parser_match_html_tags_post_analyze(
  AST_DOCUMENT_NODE_T* document,
  const parser_options_T* options,
  hb_allocator_T* allocator
) {
  if (document == NULL) { return; }

  match_tags_in_node_array(document->children, document->base.errors, options, allocator);
}
