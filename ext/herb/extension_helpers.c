#include <ruby.h>
#include <ruby/encoding.h>

#include <stdbool.h>

#include "extension.h"
#include "extension_helpers.h"
#include "nodes.h"
#include "parser_options_helpers.h"

#include "../../src/include/herb.h"
#include "../../src/include/lexer/token.h"
#include "../../src/include/lib/hb_allocator.h"
#include "../../src/include/lib/hb_string.h"
#include "../../src/include/location/location.h"
#include "../../src/include/location/position.h"

const char* check_string(VALUE value) {
  if (NIL_P(value)) { return NULL; }

  if (!RB_TYPE_P(value, T_STRING)) {
    rb_raise(rb_eTypeError, "wrong argument type %" PRIsVALUE " (expected String)", rb_obj_class(value));
  }

  return RSTRING_PTR(value);
}

static ID id_line, id_column, id_start, id_end, id_from, id_to, id_value, id_range, id_location, id_type;

static VALUE token_type_value_cache[TOKEN_EOF + 1] = { 0 };

void rb_init_extension_helpers(void) {
  id_line = rb_intern("@line");
  id_column = rb_intern("@column");
  id_start = rb_intern("@start");
  id_end = rb_intern("@end");
  id_from = rb_intern("@from");
  id_to = rb_intern("@to");
  id_value = rb_intern("@value");
  id_range = rb_intern("@range");
  id_location = rb_intern("@location");
  id_type = rb_intern("@type");

  for (unsigned int type = 0; type <= (unsigned int) TOKEN_EOF; type++) {
    token_type_value_cache[type] = rb_interned_string_from_hb_string(token_type_to_string((token_type_T) type));
    rb_gc_register_mark_object(token_type_value_cache[type]);
  }
}

VALUE rb_position_from_c_struct(position_T position) {
  VALUE object = rb_obj_alloc(cPosition);
  rb_ivar_set(object, id_line, UINT2NUM(position.line));
  rb_ivar_set(object, id_column, UINT2NUM(position.column));

  return object;
}

VALUE rb_location_from_c_struct(location_T location) {
  VALUE object = rb_obj_alloc(cLocation);
  rb_ivar_set(object, id_start, rb_position_from_c_struct(location.start));
  rb_ivar_set(object, id_end, rb_position_from_c_struct(location.end));

  return object;
}

VALUE rb_range_from_c_struct(range_T range) {
  VALUE object = rb_obj_alloc(cRange);
  rb_ivar_set(object, id_from, UINT2NUM(range.from));
  rb_ivar_set(object, id_to, UINT2NUM(range.to));

  return object;
}

VALUE rb_string_from_hb_string(hb_string_T string) {
  if (hb_string_is_null(string)) { return Qnil; }

  return rb_utf8_str_new(string.data, string.length);
}

VALUE rb_interned_string_from_hb_string(hb_string_T string) {
  if (hb_string_is_null(string)) { return Qnil; }

  return rb_enc_interned_str(string.data, string.length, rb_utf8_encoding());
}

static VALUE rb_token_type_value(token_type_T type) {
  if ((unsigned int) type > (unsigned int) TOKEN_EOF) {
    return rb_interned_string_from_hb_string(token_type_to_string(type));
  }

  return token_type_value_cache[type];
}

VALUE rb_token_from_c_struct(token_T* token, const parser_options_T* options) {
  if (!token) { return Qnil; }

  VALUE object = rb_obj_alloc(cToken);
  rb_ivar_set(object, id_value, rb_string_from_hb_string(token->value));
  rb_ivar_set(object, id_range, options->track_locations ? rb_range_from_c_struct(token->range) : Qnil);
  rb_ivar_set(object, id_location, options->track_locations ? rb_location_from_c_struct(token->location) : Qnil);
  rb_ivar_set(object, id_type, rb_token_type_value(token->type));

  return object;
}

VALUE create_lex_result(hb_array_T* tokens, VALUE source) {
  VALUE value = rb_ary_new();
  VALUE warnings = rb_ary_new();
  VALUE errors = rb_ary_new();

  for (size_t i = 0; i < hb_array_size(tokens); i++) {
    token_T* token = hb_array_get(tokens, i);
    if (token != NULL) { rb_ary_push(value, rb_token_from_c_struct(token, &HERB_DEFAULT_PARSER_OPTIONS)); }
  }

  VALUE args[4] = { value, source, warnings, errors };

  return rb_class_new_instance(4, args, cLexResult);
}

VALUE create_parse_result(AST_DOCUMENT_NODE_T* root, VALUE source, const parser_options_T* options) {
  VALUE value = rb_node_from_c_struct((AST_NODE_T*) root, options);
  VALUE warnings = rb_ary_new();
  VALUE errors = rb_ary_new();
  VALUE kwargs = herb_build_parser_options_hash(options);

  VALUE parser_options_args[1] = { kwargs };
  VALUE parser_options = rb_class_new_instance_kw(1, parser_options_args, cParserOptions, RB_PASS_KEYWORDS);

  VALUE error_count = options->error_count != NULL ? UINT2NUM(*options->error_count) : Qnil;

  VALUE args[6] = { value, source, warnings, errors, parser_options, error_count };

  return rb_class_new_instance(6, args, cParseResult);
}
