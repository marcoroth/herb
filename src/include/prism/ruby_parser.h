#ifndef HERB_RUBY_PARSER_H
#define HERB_RUBY_PARSER_H

#include "../lib/hb_string.h"

#include <stdbool.h>

void herb_parse_ruby_to_stdout(char* source);

bool herb_ruby_fragment_is_parseable(hb_string_T source);

#endif
