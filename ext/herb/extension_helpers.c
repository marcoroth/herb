#include <ruby.h>

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

VALUE rb_position_from_c_struct(position_T* position) {
  if (!position) { return Qnil; }

  VALUE args[2];
  args[0] = SIZET2NUM(position->line);
  args[1] = SIZET2NUM(position->column);

  VALUE Herb = rb_define_module("Herb");
  VALUE Position = rb_define_class_under(Herb, "Position", rb_cObject);

  return rb_class_new_instance(2, args, Position);
}

VALUE rb_location_from_c_struct(location_T* location) {
  if (!location) { return Qnil; }

  VALUE args[2];
  args[0] = rb_position_from_c_struct(location->start);
  args[1] = rb_position_from_c_struct(location->end);

  VALUE Herb = rb_define_module("Herb");
  VALUE Location = rb_define_class_under(Herb, "Location", rb_cObject);

  return rb_class_new_instance(2, args, Location);
}

VALUE rb_range_from_c_struct(range_T* range) {
  if (!range) { return Qnil; }

  VALUE args[2];
  args[0] = SIZET2NUM(range->from);
  args[1] = SIZET2NUM(range->to);

  VALUE Herb = rb_define_module("Herb");
  VALUE Range = rb_define_class_under(Herb, "Range", rb_cObject);

  return rb_class_new_instance(2, args, Range);
}

VALUE rb_token_from_c_struct(token_T* token) {
  if (!token) { return Qnil; }

  VALUE value = token->value ? rb_str_new_cstr(token->value) : Qnil;

  VALUE range = rb_range_from_c_struct(token->range);
  VALUE location = rb_location_from_c_struct(token->location);
  VALUE type = rb_str_new_cstr(token_type_to_string(token->type));

  VALUE args[4] = { value, range, location, type };

  VALUE Herb = rb_define_module("Herb");
  VALUE Token = rb_define_class_under(Herb, "Token", rb_cObject);

  return rb_class_new_instance(4, args, Token);
}

VALUE create_lex_result(array_T* tokens, VALUE source) {
  VALUE value = rb_ary_new();
  VALUE warnings = rb_ary_new();
  VALUE errors = rb_ary_new();

  for (size_t i = 0; i < array_size(tokens); i++) {
    token_T* token = array_get(tokens, i);
    if (token != NULL) { rb_ary_push(value, rb_token_from_c_struct(token)); }
  }

  VALUE Herb = rb_define_module("Herb");
  VALUE Result = rb_define_class_under(Herb, "Result", rb_cObject);
  VALUE LexResult = rb_define_class_under(Herb, "LexResult", Result);

  VALUE args[4] = { value, source, warnings, errors };

  return rb_class_new_instance(4, args, LexResult);
}

VALUE create_parse_result(AST_DOCUMENT_NODE_T* root, VALUE source) {
  VALUE value = rb_node_from_c_struct((AST_NODE_T*) root);
  VALUE warnings = rb_ary_new();
  VALUE errors = rb_ary_new();

  VALUE Herb = rb_define_module("Herb");
  VALUE Result = rb_define_class_under(Herb, "Result", rb_cObject);
  VALUE ParseResult = rb_define_class_under(Herb, "ParseResult", Result);

  VALUE args[4] = { value, source, warnings, errors };

  return rb_class_new_instance(4, args, ParseResult);
}

VALUE read_file_to_ruby_string(const char* file_path) {
  char* source = herb_read_file(file_path);
  VALUE source_value = rb_str_new_cstr(source);

  free(source);

  return source_value;
}
