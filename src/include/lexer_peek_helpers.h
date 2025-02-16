#ifndef ERBX_LEXER_PEEK_H
#define ERBX_LEXER_PEEK_H

#include "lexer_struct.h"

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>

char lexer_peek(lexer_T* lexer, int offset);
bool lexer_peek_for_doctype(lexer_T* lexer, int offset);

bool lexer_peek_for_html_comment_start(lexer_T* lexer, int offset);
bool lexer_peek_for_html_comment_end(lexer_T* lexer, int offset);

bool lexer_peek_erb_close_tag(lexer_T* lexer, int offset);
bool lexer_peek_erb_dash_close_tag(lexer_T* lexer, int offset);
bool lexer_peek_erb_percent_close_tag(lexer_T* lexer, int offset);
bool lexer_peek_erb_end(lexer_T* lexer, int offset);

char lexer_backtrack(lexer_T* lexer, int offset);

#endif
