#ifndef ERBX_LEXER_H
#define ERBX_LEXER_H

#include "lexer_struct.h"
#include "token_struct.h"

lexer_T* lexer_init(char* source);
token_T* lexer_next_token(lexer_T* lexer);
token_T* lexer_error(const lexer_T* lexer, const char* message);

void lexer_free(lexer_T* lexer);

#endif
