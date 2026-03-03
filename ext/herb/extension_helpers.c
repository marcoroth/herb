#include <ruby.h>

#include "extension.h"
#include "extension_helpers.h"
#include "nodes.h"

#include "../../src/include/herb.h"
#include "../../src/include/io.h"
#include "../../src/include/location.h"
#include "../../src/include/position.h"
#include "../../src/include/token.h"

const char* check_string(VALUE value) {
  if (NIL_P(value)) { return NULL; }

  if (!RB_TYPE_P(value, T_STRING)) {
    rb_raise(rb_eTypeError, "wrong argument type %" PRIsVALUE " (expected String)", rb_obj_class(value));
  }

  return RSTRING_PTR(value);
}

VALUE rb_position_from_c_struct(position_T position) {
  VALUE args[2];
  args[0] = UINT2NUM(position.line);
  args[1] = UINT2NUM(position.column);

  return rb_class_new_instance(2, args, cPosition);
}

VALUE rb_location_from_c_struct(location_T location) {
  VALUE args[2];
  args[0] = rb_position_from_c_struct(location.start);
  args[1] = rb_position_from_c_struct(location.end);

  return rb_class_new_instance(2, args, cLocation);
}

VALUE rb_range_from_c_struct(range_T range) {
  VALUE args[2];
  args[0] = UINT2NUM(range.from);
  args[1] = UINT2NUM(range.to);

  return rb_class_new_instance(2, args, cRange);
}

VALUE rb_token_from_c_struct(token_T* token) {
  if (!token) { return Qnil; }

  VALUE value = token->value ? rb_utf8_str_new_cstr(token->value) : Qnil;

  VALUE range = rb_range_from_c_struct(token->range);
  VALUE location = rb_location_from_c_struct(token->location);
  VALUE type = rb_utf8_str_new_cstr(token_type_to_string(token->type));

  VALUE args[4] = { value, range, location, type };

  return rb_class_new_instance(4, args, cToken);
}

VALUE create_lex_result(hb_array_T* tokens, VALUE source) {
  VALUE value = rb_ary_new();
  VALUE warnings = rb_ary_new();
  VALUE errors = rb_ary_new();

  for (size_t i = 0; i < hb_array_size(tokens); i++) {
    token_T* token = hb_array_get(tokens, i);
    if (token != NULL) { rb_ary_push(value, rb_token_from_c_struct(token)); }
  }

  VALUE args[4] = { value, source, warnings, errors };

  return rb_class_new_instance(4, args, cLexResult);
}

VALUE create_parse_result(AST_DOCUMENT_NODE_T* root, VALUE source, const parser_options_T* options) {
  VALUE value = rb_node_from_c_struct((AST_NODE_T*) root);
  VALUE warnings = rb_ary_new();
  VALUE errors = rb_ary_new();

  VALUE kwargs = rb_hash_new();
  rb_hash_aset(kwargs, ID2SYM(rb_intern("strict")), options->strict ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("track_whitespace")), options->track_whitespace ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("analyze")), options->analyze ? Qtrue : Qfalse);

  VALUE parser_options_args[1] = { kwargs };
  VALUE parser_options = rb_class_new_instance_kw(1, parser_options_args, cParserOptions, RB_PASS_KEYWORDS);

  VALUE args[5] = { value, source, warnings, errors, parser_options };

  return rb_class_new_instance(5, args, cParseResult);
}

VALUE read_file_to_ruby_string(const char* file_path) {
  char* source = herb_read_file(file_path);
  VALUE source_value = rb_utf8_str_new_cstr(source);

  free(source);

  return source_value;
}
