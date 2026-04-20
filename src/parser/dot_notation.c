#include "../include/parser/dot_notation.h"
#include "../include/errors.h"
#include "../include/lexer/lexer.h"
#include "../include/lexer/token.h"
#include "../include/parser/parser_helpers.h"

#include <ctype.h>

static bool token_is_dot(token_T* token) {
  return token->type == TOKEN_CHARACTER && token->value.length == 1 && token->value.data[0] == '.';
}

static bool current_token_is_dot(parser_T* parser) {
  return token_is_dot(parser->current_token);
}

static void consume_dot_notation_loop(parser_T* parser, token_T* tag_name, hb_array_T* errors) {
  while (current_token_is_dot(parser)) {
    token_T* dot = parser_advance(parser);
    token_T* segment = parser_consume_expected(parser, TOKEN_IDENTIFIER, errors);

    if (segment == NULL || segment->value.length == 0) {
      if (segment) { token_free(segment, parser->allocator); }
      token_free(dot, parser->allocator);
      break;
    }

    uint32_t new_length = (uint32_t) (segment->value.data + segment->value.length - tag_name->value.data);
    tag_name->value.length = new_length;
    tag_name->location.end = segment->location.end;
    tag_name->range.to = segment->range.to;

    token_free(segment, parser->allocator);
    token_free(dot, parser->allocator);
  }
}

bool parser_lookahead_is_valid_dot_notation_open_tag(parser_T* parser) {
  lexer_T lexer_copy = *parser->lexer;
  token_T* name = lexer_next_token(&lexer_copy);

  if (name == NULL || name->type != TOKEN_IDENTIFIER) {
    if (name) { token_free(name, parser->allocator); }
    return false;
  }

  bool first_is_upper = name->value.length > 0 && isupper((unsigned char) name->value.data[0]);
  token_free(name, parser->allocator);
  token_T* next = lexer_next_token(&lexer_copy);

  if (next == NULL) { return true; }

  bool is_dot = token_is_dot(next);
  token_free(next, parser->allocator);

  if (!is_dot) { return true; }
  if (!parser->options.dot_notation_tags) { return true; }
  if (!first_is_upper) { return true; }

  next = lexer_next_token(&lexer_copy);

  while (next != NULL) {
    if (next->type != TOKEN_IDENTIFIER || next->value.length == 0) {
      token_free(next, parser->allocator);
      return true;
    }

    token_free(next, parser->allocator);
    next = lexer_next_token(&lexer_copy);

    if (next == NULL) { return true; }

    is_dot = token_is_dot(next);
    token_free(next, parser->allocator);

    if (!is_dot) { return true; }

    next = lexer_next_token(&lexer_copy);
  }

  return true;
}

void parser_consume_dot_notation_segments(parser_T* parser, token_T* tag_name, hb_array_T* errors) {
  if (!parser->options.dot_notation_tags) { return; }
  if (tag_name == NULL || tag_name->value.length == 0) { return; }
  if (!current_token_is_dot(parser)) { return; }

  if (!isupper((unsigned char) tag_name->value.data[0])) {
    append_dot_notation_casing_error(
      tag_name,
      tag_name->location.start,
      tag_name->location.end,
      parser->allocator,
      errors
    );
  }

  consume_dot_notation_loop(parser, tag_name, errors);
}
