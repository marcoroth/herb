#ifndef HERB_TOKEN_H
#define HERB_TOKEN_H

#include "lexer_struct.h"
#include "position.h"
#include "token_struct.h"
#include "util/hb_allocator.h"
#include "util/hb_string.h"

#include <stdarg.h>

token_T* token_init(hb_string_T value, token_type_T type, lexer_T* lexer);
hb_string_T token_to_string(const token_T* token);
hb_string_T token_type_to_string(token_type_T type);
hb_string_T token_type_to_friendly_string(token_type_T type);
char* token_types_to_friendly_string_va(hb_allocator_T* allocator, token_type_T first_token, ...);
char* token_types_to_friendly_string_valist(hb_allocator_T* allocator, token_type_T first_token, va_list args);

#define token_types_to_friendly_string(allocator, ...)                                                                 \
  token_types_to_friendly_string_va(allocator, __VA_ARGS__, TOKEN_SENTINEL)

hb_string_T token_value(const token_T* token);
int token_type(const token_T* token);

token_T* token_copy(token_T* token, hb_allocator_T* allocator);

void token_free(token_T* token, hb_allocator_T* allocator);

bool token_value_empty(const token_T* token);

#endif
