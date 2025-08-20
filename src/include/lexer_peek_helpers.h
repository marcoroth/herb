#ifndef HERB_LEXER_PEEK_HELPERS_H
#define HERB_LEXER_PEEK_HELPERS_H

#include "lexer_struct.h"
#include "token_struct.h"

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>

char lexer_peek(const lexer_T* lexer, int offset);
bool lexer_peek_for_doctype(const lexer_T* lexer, int offset);

bool lexer_peek_for_html_comment_start(const lexer_T* lexer, int offset);
bool lexer_peek_for_html_comment_end(const lexer_T* lexer, int offset);

bool lexer_peek_erb_close_tag(const lexer_T* lexer, int offset);
bool lexer_peek_erb_dash_close_tag(const lexer_T* lexer, int offset);
bool lexer_peek_erb_percent_close_tag(const lexer_T* lexer, int offset);
bool lexer_peek_erb_end(const lexer_T* lexer, int offset);

char lexer_backtrack(const lexer_T* lexer, int offset);

bool lexer_peek_for_token_type_after_whitespace(lexer_T* lexer, token_type_T token_type);

#endif
