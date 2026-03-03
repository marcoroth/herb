#ifndef HERB_EXTENSION_HERB_H
#define HERB_EXTENSION_HERB_H

#include <ruby.h>

#include "../../src/include/herb.h"
#include "../../src/include/location.h"
#include "../../src/include/position.h"
#include "../../src/include/range.h"
#include "../../src/include/token.h"

const char* check_string(VALUE value);
VALUE read_file_to_ruby_string(const char* file_path);

VALUE rb_position_from_c_struct(position_T position);
VALUE rb_location_from_c_struct(location_T location);

VALUE rb_token_from_c_struct(token_T* token);
VALUE rb_range_from_c_struct(range_T range);

VALUE create_lex_result(hb_array_T* tokens, VALUE source);
VALUE create_parse_result(AST_DOCUMENT_NODE_T* root, VALUE source, const parser_options_T* options);

#endif
