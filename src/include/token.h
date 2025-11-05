#ifndef HERB_TOKEN_H
#define HERB_TOKEN_H

#include "lexer_struct.h"
#include "position.h"
#include "token_struct.h"
#include "util/hb_string.h"

token_T* token_init(const char* value, token_type_T type, lexer_T* lexer);
hb_string_T token_to_string(const token_T* token);
const char* token_type_to_string(token_type_T type);

token_T* token_copy(token_T* token);

void token_free(token_T* token);

#endif
