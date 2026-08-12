#ifndef HERB_LEXER_H
#define HERB_LEXER_H

#include "../lexer/token_struct.h"
#include "lexer_struct.h"

void lexer_init(lexer_T* lexer, const char* source, hb_allocator_T* allocator);
token_T* lexer_next_token(lexer_T* lexer);
token_T* lexer_error(lexer_T* lexer, const char* message);

#endif
