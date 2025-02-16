#ifndef ERBX_LEXER_H
#define ERBX_LEXER_H

#include "lexer_struct.h"
#include "token_struct.h"

lexer_T* lexer_init(char* source);

void lexer_advance(lexer_T* lexer);
char lexer_peek(lexer_T* lexer, int offset);
char lexer_backtrack(lexer_T* lexer, int offset);

token_T* lexer_next_token(lexer_T* lexer);

size_t lexer_sizeof(void);

#endif
