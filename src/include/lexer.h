#ifndef ERBX_LEXER_H
#define ERBX_LEXER_H

#include "lexer_struct.h"
#include "token_struct.h"

lexer_T* lexer_init(char* source);

void lexer_skip_whitespace(lexer_T* lexer);
void lexer_advance(lexer_T* lexer);
char lexer_peek(lexer_T* lexer, int offset);
char lexer_backtrack(lexer_T* lexer, int offset);

token_T* lexer_advance_current(lexer_T* lexer, int type);
token_T* lexer_next_token(lexer_T* lexer);
token_T* lexer_parse_attribute_name(lexer_T* lexer);
token_T* lexer_parse_attribute_value(lexer_T* lexer);
token_T* lexer_parse_double_quoted_id(lexer_T* lexer);
token_T* lexer_parse_newline(lexer_T* lexer);
token_T* lexer_parse_single_quoted_id(lexer_T* lexer);
token_T* lexer_parse_tag_name(lexer_T* lexer);
token_T* lexer_parse_whitespace(lexer_T* lexer);

size_t lexer_sizeof(void);

#endif
