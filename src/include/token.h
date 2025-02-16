#ifndef ERBX_TOKEN_H
#define ERBX_TOKEN_H

#include "lexer_struct.h"
#include "token_struct.h"

token_T* token_init(const char* value, token_type_T type, lexer_T* lexer);
char* token_to_string(token_T* token);
const char* token_type_to_string(token_type_T type);

char* token_value(token_T* token);
int token_type(token_T* token);

size_t token_sizeof(void);

void token_free(token_T* token);

#endif
