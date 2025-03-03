#include "include/token_matchers.h"
#include "include/parser.h"
#include "include/token.h"

#include <stdarg.h>
#include <stdbool.h>

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
