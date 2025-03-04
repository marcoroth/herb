#ifndef ERBX_EXTENSION_ERBX_H
#define ERBX_EXTENSION_ERBX_H

#include <ruby.h>

#include "../../src/include/erbx.h"
#include "../../src/include/location.h"
#include "../../src/include/range.h"
#include "../../src/include/token.h"

const char* check_string(VALUE value);
VALUE read_file_to_ruby_string(const char* file_path);

VALUE rb_location_from_c_struct(location_T* location);
VALUE rb_token_from_c_struct(token_T* token);
VALUE rb_range_from_c_struct(range_T* range);

VALUE create_lex_result(array_T* tokens, VALUE source);
VALUE create_parse_result(AST_DOCUMENT_NODE_T* root, VALUE source);

#endif
