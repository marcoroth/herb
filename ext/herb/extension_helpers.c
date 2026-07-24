#include <ruby.h>

#include <stdbool.h>

#include "extension.h"
#include "extension_helpers.h"
#include "nodes.h"

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

// Whether to materialize source Location/Range/Position objects while building
// the Ruby AST. For rendering (no validation, no debug), locations are never
// read, yet they account for ~50% of parse allocations and ~28% of parse time
// (each node and token otherwise builds a Location from two Positions). When a
// caller passes `track_locations: false` to Herb.parse, these are left as nil.
// Set per-parse from Herb_parse; safe because AST materialization runs under
// the GVL, so no two parses materialize concurrently.
bool herb_ext_track_locations = true;

// Cached instance-variable IDs for the hot AST value objects (Position,
// Location, Range, Token). Building these via rb_obj_alloc + rb_ivar_set sets
// the ivars directly, mirroring the Ruby classes' initializers.
static ID id_line, id_column, id_start, id_end, id_from, id_to;
static ID id_value, id_range, id_location, id_type;
static bool ast_value_ivar_ids_initialized = false;

static void init_ast_value_ivar_ids(void) {
  if (ast_value_ivar_ids_initialized) { return; }

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

  ast_value_ivar_ids_initialized = true;
}

VALUE rb_position_from_c_struct(position_T position) {
  init_ast_value_ivar_ids();

  VALUE obj = rb_obj_alloc(cPosition);
  rb_ivar_set(obj, id_line, UINT2NUM(position.line));
  rb_ivar_set(obj, id_column, UINT2NUM(position.column));

  return obj;
}

VALUE rb_location_from_c_struct(location_T location) {
  if (!herb_ext_track_locations) { return Qnil; }

  init_ast_value_ivar_ids();

  VALUE obj = rb_obj_alloc(cLocation);
  rb_ivar_set(obj, id_start, rb_position_from_c_struct(location.start));
  rb_ivar_set(obj, id_end, rb_position_from_c_struct(location.end));

  return obj;
}

VALUE rb_range_from_c_struct(range_T range) {
  if (!herb_ext_track_locations) { return Qnil; }

  init_ast_value_ivar_ids();

  VALUE obj = rb_obj_alloc(cRange);
  rb_ivar_set(obj, id_from, UINT2NUM(range.from));
  rb_ivar_set(obj, id_to, UINT2NUM(range.to));

  return obj;
}

VALUE rb_string_from_hb_string(hb_string_T string) {
  if (hb_string_is_null(string)) { return Qnil; }

  return rb_utf8_str_new(string.data, string.length);
}

VALUE rb_token_from_c_struct(token_T* token) {
  if (!token) { return Qnil; }

  init_ast_value_ivar_ids();

  VALUE obj = rb_obj_alloc(cToken);
  rb_ivar_set(obj, id_value, rb_string_from_hb_string(token->value));
  rb_ivar_set(obj, id_range, rb_range_from_c_struct(token->range));
  rb_ivar_set(obj, id_location, rb_location_from_c_struct(token->location));
  rb_ivar_set(obj, id_type, rb_string_from_hb_string(token_type_to_string(token->type)));

  return obj;
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
  rb_hash_aset(kwargs, ID2SYM(rb_intern("action_view_helpers")), options->action_view_helpers ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("transform_conditionals")), options->transform_conditionals ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("render_nodes")), options->render_nodes ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("strict_locals")), options->strict_locals ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("prism_nodes")), options->prism_nodes ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("prism_nodes_deep")), options->prism_nodes_deep ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("prism_program")), options->prism_program ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("timeout")), DBL2NUM((double) options->timeout_ms / 1000.0));

  rb_hash_aset(
    kwargs,
    ID2SYM(rb_intern("max_errors")),
    options->max_errors == 0 ? Qnil : UINT2NUM(options->max_errors)
  );

  VALUE parser_options_args[1] = { kwargs };
  VALUE parser_options = rb_class_new_instance_kw(1, parser_options_args, cParserOptions, RB_PASS_KEYWORDS);

  VALUE args[5] = { value, source, warnings, errors, parser_options };

  return rb_class_new_instance(5, args, cParseResult);
}
