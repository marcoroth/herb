#ifndef ERBX_TOKEN_MATCHERS_H
#define ERBX_TOKEN_MATCHERS_H

#include "parser.h"
#include "token.h"

#include <stdarg.h>
#include <stdbool.h>

// This "TOKEN" is used to terminate the va_list arguments in the token_matches_any function
#define TOKEN_SENTINEL 99999999

bool token_matches_any(token_type_T current_token, token_type_T first_token, ...);

#define token_is_any_of(parser, ...) (token_matches_any((parser)->current_token->type, __VA_ARGS__, TOKEN_SENTINEL))
#define token_is_none_of(parser, ...) (!token_matches_any((parser)->current_token->type, __VA_ARGS__, TOKEN_SENTINEL))

#endif
