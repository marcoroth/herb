#ifndef ERBX_TOKEN_H
#define ERBX_TOKEN_H

#include <stdlib.h>

#include "lexer_struct.h"
#include "token_struct.h"

token_T* token_init(char* value, int type, lexer_T* lexer);
char* token_to_string(token_T* token);
const char* token_type_to_string(int type);

size_t token_sizeof(void);

#endif
