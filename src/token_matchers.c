#include "include/token_matchers.h"
#include "include/parser.h"
#include "include/token.h"

#include <stdarg.h>
#include <stdbool.h>

bool token_is(parser_T* parser, token_type_T expected_type) {
  return parser->current_token->type == expected_type;
}

bool token_is_not(parser_T* parser, token_type_T type) {
  return parser->current_token->type != type;
}

bool token_matches_any(token_type_T current_token, token_type_T first_token, ...) {
  if (current_token == first_token) { return true; }

  va_list tokens;
  va_start(tokens, first_token);
  token_type_T token;

  while ((token = va_arg(tokens, token_type_T)) != TOKEN_SENTINEL) {
    if (current_token == token) {
      va_end(tokens);
      return true;
    }
  }

  va_end(tokens);
  return false;
}
