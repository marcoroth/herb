#ifndef HERB_LEXER_H
#define HERB_LEXER_H

#include "lexer_struct.h"
#include "token_struct.h"
#include "util/hb_arena.h"

void lexer_init(lexer_T* lexer, hb_arena_T* allocator, const char* source);
token_T* lexer_next_token(lexer_T* lexer);
token_T* lexer_error(lexer_T* lexer, const char* message);

#endif
