#ifndef HERB_PARSER_DOT_NOTATION_H
#define HERB_PARSER_DOT_NOTATION_H

#include <stdbool.h>

#include "../lib/hb_array.h"
#include "parser.h"

bool parser_lookahead_is_valid_dot_notation_open_tag(parser_T* parser);
void parser_consume_dot_notation_segments(parser_T* parser, token_T* tag_name, hb_array_T* errors);

#endif
