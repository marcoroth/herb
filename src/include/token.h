#ifndef HERB_TOKEN_H
#define HERB_TOKEN_H

#include "lexer_struct.h"
#include "token_struct.h"

token_T* token_init(const char* value, token_type_T type, const lexer_T* lexer);
char* token_to_string(const token_T* token);
char* token_to_json(const token_T* token);
const char* token_type_to_string(token_type_T type);

char* token_value(const token_T* token);
int token_type(const token_T* token);

size_t token_sizeof(void);

token_T* token_copy(token_T* token);

void token_free(token_T* token);

#endif
