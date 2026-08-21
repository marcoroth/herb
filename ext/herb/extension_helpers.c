#include <ruby.h>
#include <ruby/encoding.h>

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

// Cached ivar IDs for the raw numeric range/location components `Herb::Token` stores
// when locations are tracked, computed once via `rb_intern` and reused on every token
// construction to avoid repeated symbol lookups in the lex/parse hot path. The
// `Range`/`Location`/`Position` objects themselves are only materialized lazily, on
// first access to `Herb::Token#range`/`#location` (see `lib/herb/token.rb`).
static ID id_ivar_range_from;
static ID id_ivar_range_to;
static ID id_ivar_loc_start_line;
static ID id_ivar_loc_start_column;
static ID id_ivar_loc_end_line;
static ID id_ivar_loc_end_column;
static bool token_ivar_ids_initialized = false;

static void init_token_ivar_ids(void) {
  if (token_ivar_ids_initialized) { return; }

  id_ivar_range_from = rb_intern("@range_from");
  id_ivar_range_to = rb_intern("@range_to");
  id_ivar_loc_start_line = rb_intern("@loc_start_line");
  id_ivar_loc_start_column = rb_intern("@loc_start_column");
  id_ivar_loc_end_line = rb_intern("@loc_end_line");
  id_ivar_loc_end_column = rb_intern("@loc_end_column");

  token_ivar_ids_initialized = true;
}

const char* check_string(VALUE value) {
  if (NIL_P(value)) { return NULL; }

  if (!RB_TYPE_P(value, T_STRING)) {
    rb_raise(rb_eTypeError, "wrong argument type %" PRIsVALUE " (expected String)", rb_obj_class(value));
  }

  return RSTRING_PTR(value);
}

static ID id_line, id_column, id_start, id_end, id_from, id_to, id_value, id_range, id_location, id_type;
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

  VALUE object = rb_obj_alloc(cPosition);
  rb_ivar_set(object, id_line, UINT2NUM(position.line));
  rb_ivar_set(object, id_column, UINT2NUM(position.column));

  return object;
}

VALUE rb_location_from_c_struct(location_T location) {
  init_ast_value_ivar_ids();

  VALUE object = rb_obj_alloc(cLocation);
  rb_ivar_set(object, id_start, rb_position_from_c_struct(location.start));
  rb_ivar_set(object, id_end, rb_position_from_c_struct(location.end));

  return object;
}

VALUE rb_range_from_c_struct(range_T range) {
  init_ast_value_ivar_ids();

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

static VALUE token_type_value_cache[TOKEN_EOF + 1] = { 0 };

static VALUE rb_token_type_value(token_type_T type) {
  if ((unsigned int) type > (unsigned int) TOKEN_EOF) {
    return rb_interned_string_from_hb_string(token_type_to_string(type));
  }

  VALUE cached = token_type_value_cache[type];

  if (cached == 0) {
    cached = rb_interned_string_from_hb_string(token_type_to_string(type));
    rb_gc_register_mark_object(cached);
    token_type_value_cache[type] = cached;
  }

  return cached;
}

VALUE rb_token_from_c_struct(token_T* token, const parser_options_T* options) {
  if (!token) { return Qnil; }

  init_ast_value_ivar_ids();
  init_token_ivar_ids();

  VALUE object = rb_obj_alloc(cToken);
  rb_ivar_set(object, id_value, rb_string_from_hb_string(token->value));
  rb_ivar_set(object, id_type, rb_token_type_value(token->type));

  // Defer building `Range`/`Location`/`Position` Ruby objects until they're actually
  // accessed via `Herb::Token#range`/`#location`. The raw numeric components are cheap
  // to copy out of the (arena-allocated) `token_T*` up front; storing them as plain
  // ivars instead of eagerly allocating the wrapper objects avoids the bulk of Token's
  // allocations when callers never touch `#range`/`#location` (see `lib/herb/token.rb`).
  if (options->track_locations) {
    rb_ivar_set(object, id_ivar_range_from, UINT2NUM(token->range.from));
    rb_ivar_set(object, id_ivar_range_to, UINT2NUM(token->range.to));
    rb_ivar_set(object, id_ivar_loc_start_line, UINT2NUM(token->location.start.line));
    rb_ivar_set(object, id_ivar_loc_start_column, UINT2NUM(token->location.start.column));
    rb_ivar_set(object, id_ivar_loc_end_line, UINT2NUM(token->location.end.line));
    rb_ivar_set(object, id_ivar_loc_end_column, UINT2NUM(token->location.end.column));
  }

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

  VALUE kwargs = rb_hash_new();
  rb_hash_aset(kwargs, ID2SYM(rb_intern("strict")), options->strict ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("track_whitespace")), options->track_whitespace ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("track_locations")), options->track_locations ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("analyze")), options->analyze ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("action_view_helpers")), options->action_view_helpers ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("transform_conditionals")), options->transform_conditionals ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("render_nodes")), options->render_nodes ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("strict_locals")), options->strict_locals ? Qtrue : Qfalse);
  rb_hash_aset(kwargs, ID2SYM(rb_intern("iteration_nodes")), options->iteration_nodes ? Qtrue : Qfalse);
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

  VALUE error_count = options->error_count != NULL ? UINT2NUM(*options->error_count) : Qnil;

  VALUE args[6] = { value, source, warnings, errors, parser_options, error_count };

  return rb_class_new_instance(6, args, cParseResult);
}
