#include <ruby.h>

#include "../../src/include/lib/hb_allocator.h"
#include "../../src/include/lib/hb_arena_debug.h"

#include "error_helpers.h"
#include "extension.h"
#include "extension_helpers.h"
#include "nodes.h"

VALUE mHerb;
VALUE cPosition;
VALUE cLocation;
VALUE cRange;
VALUE cToken;
VALUE cResult;
VALUE cLexResult;
VALUE cParseResult;
VALUE cParserOptions;

typedef struct {
  AST_DOCUMENT_NODE_T* root;
  VALUE source;
  const parser_options_T* parser_options;
  hb_allocator_T allocator;
} parse_args_T;

typedef struct {
  hb_array_T* tokens;
  VALUE source;
  hb_allocator_T allocator;
} lex_args_T;

typedef struct {
  char* buffer_value;
  hb_allocator_T allocator;
} buffer_args_T;

static VALUE parse_convert_body(VALUE arg) {
  parse_args_T* args = (parse_args_T*) arg;

  return create_parse_result(args->root, args->source, args->parser_options);
}

static VALUE parse_cleanup(VALUE arg) {
  parse_args_T* args = (parse_args_T*) arg;

  if (args->root != NULL) { ast_node_free((AST_NODE_T*) args->root, &args->allocator); }

  hb_allocator_destroy(&args->allocator);

  return Qnil;
}

static VALUE lex_convert_body(VALUE arg) {
  lex_args_T* args = (lex_args_T*) arg;

  return create_lex_result(args->tokens, args->source);
}

static VALUE lex_cleanup(VALUE arg) {
  lex_args_T* args = (lex_args_T*) arg;

  if (args->tokens != NULL) { herb_free_tokens(&args->tokens, &args->allocator); }

  hb_allocator_destroy(&args->allocator);

  return Qnil;
}

static VALUE buffer_to_string_body(VALUE arg) {
  buffer_args_T* args = (buffer_args_T*) arg;

  return rb_utf8_str_new_cstr(args->buffer_value);
}

static VALUE buffer_cleanup(VALUE arg) {
  buffer_args_T* args = (buffer_args_T*) arg;

  hb_allocator_dealloc(&args->allocator, args->buffer_value);
  hb_allocator_destroy(&args->allocator);

  return Qnil;
}

static VALUE Herb_lex(int argc, VALUE* argv, VALUE self) {
  VALUE source, options;
  rb_scan_args(argc, argv, "1:", &source, &options);

  char* string = (char*) check_string(source);
  bool print_arena_stats = false;

  if (!NIL_P(options)) {
    VALUE arena_stats = rb_hash_lookup(options, rb_utf8_str_new_cstr("arena_stats"));
    if (NIL_P(arena_stats)) { arena_stats = rb_hash_lookup(options, ID2SYM(rb_intern("arena_stats"))); }
    if (!NIL_P(arena_stats) && RTEST(arena_stats)) { print_arena_stats = true; }
  }

  lex_args_T args = { 0 };
  args.source = source;

  if (!hb_allocator_init(&args.allocator, HB_ALLOCATOR_ARENA)) { return Qnil; }

  args.tokens = herb_lex(string, &args.allocator);

  if (print_arena_stats) { hb_arena_print_stats((hb_arena_T*) args.allocator.context); }

  return rb_ensure(lex_convert_body, (VALUE) &args, lex_cleanup, (VALUE) &args);
}

static VALUE Herb_parse(int argc, VALUE* argv, VALUE self) {
  VALUE source, options;
  rb_scan_args(argc, argv, "1:", &source, &options);

  char* string = (char*) check_string(source);
  bool print_arena_stats = false;

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;

  if (!NIL_P(options)) {
    VALUE track_whitespace = rb_hash_lookup(options, rb_utf8_str_new_cstr("track_whitespace"));
    if (NIL_P(track_whitespace)) { track_whitespace = rb_hash_lookup(options, ID2SYM(rb_intern("track_whitespace"))); }
    if (!NIL_P(track_whitespace) && RTEST(track_whitespace)) { parser_options.track_whitespace = true; }

    VALUE analyze = rb_hash_lookup(options, rb_utf8_str_new_cstr("analyze"));
    if (NIL_P(analyze)) { analyze = rb_hash_lookup(options, ID2SYM(rb_intern("analyze"))); }
    if (!NIL_P(analyze) && !RTEST(analyze)) { parser_options.analyze = false; }

    VALUE strict = rb_hash_lookup(options, rb_utf8_str_new_cstr("strict"));
    if (NIL_P(strict)) { strict = rb_hash_lookup(options, ID2SYM(rb_intern("strict"))); }
    if (!NIL_P(strict)) { parser_options.strict = RTEST(strict); }

    VALUE action_view_helpers = rb_hash_lookup(options, rb_utf8_str_new_cstr("action_view_helpers"));
    if (NIL_P(action_view_helpers)) {
      action_view_helpers = rb_hash_lookup(options, ID2SYM(rb_intern("action_view_helpers")));
    }
    if (!NIL_P(action_view_helpers) && RTEST(action_view_helpers)) { parser_options.action_view_helpers = true; }

    VALUE transform_conditionals = rb_hash_lookup(options, rb_utf8_str_new_cstr("transform_conditionals"));
    if (NIL_P(transform_conditionals)) {
      transform_conditionals = rb_hash_lookup(options, ID2SYM(rb_intern("transform_conditionals")));
    }
    if (!NIL_P(transform_conditionals) && RTEST(transform_conditionals)) {
      parser_options.transform_conditionals = true;
    }

    VALUE dot_notation_tags = rb_hash_lookup(options, rb_utf8_str_new_cstr("dot_notation_tags"));
    if (NIL_P(dot_notation_tags)) {
      dot_notation_tags = rb_hash_lookup(options, ID2SYM(rb_intern("dot_notation_tags")));
    }
    if (!NIL_P(dot_notation_tags) && RTEST(dot_notation_tags)) { parser_options.dot_notation_tags = true; }

    VALUE render_nodes = rb_hash_lookup(options, rb_utf8_str_new_cstr("render_nodes"));
    if (NIL_P(render_nodes)) { render_nodes = rb_hash_lookup(options, ID2SYM(rb_intern("render_nodes"))); }
    if (!NIL_P(render_nodes) && RTEST(render_nodes)) { parser_options.render_nodes = true; }

    VALUE strict_locals = rb_hash_lookup(options, rb_utf8_str_new_cstr("strict_locals"));
    if (NIL_P(strict_locals)) { strict_locals = rb_hash_lookup(options, ID2SYM(rb_intern("strict_locals"))); }
    if (!NIL_P(strict_locals) && RTEST(strict_locals)) { parser_options.strict_locals = true; }

    VALUE prism_nodes = rb_hash_lookup(options, rb_utf8_str_new_cstr("prism_nodes"));
    if (NIL_P(prism_nodes)) { prism_nodes = rb_hash_lookup(options, ID2SYM(rb_intern("prism_nodes"))); }
    if (!NIL_P(prism_nodes) && RTEST(prism_nodes)) { parser_options.prism_nodes = true; }

    VALUE prism_nodes_deep = rb_hash_lookup(options, rb_utf8_str_new_cstr("prism_nodes_deep"));
    if (NIL_P(prism_nodes_deep)) { prism_nodes_deep = rb_hash_lookup(options, ID2SYM(rb_intern("prism_nodes_deep"))); }
    if (!NIL_P(prism_nodes_deep) && RTEST(prism_nodes_deep)) { parser_options.prism_nodes_deep = true; }

    VALUE prism_program = rb_hash_lookup(options, rb_utf8_str_new_cstr("prism_program"));
    if (NIL_P(prism_program)) { prism_program = rb_hash_lookup(options, ID2SYM(rb_intern("prism_program"))); }
    if (!NIL_P(prism_program) && RTEST(prism_program)) { parser_options.prism_program = true; }

    VALUE html = rb_hash_lookup(options, rb_utf8_str_new_cstr("html"));
    if (NIL_P(html)) { html = rb_hash_lookup(options, ID2SYM(rb_intern("html"))); }
    if (!NIL_P(html) && !RTEST(html)) { parser_options.html = false; }

    VALUE arena_stats = rb_hash_lookup(options, rb_utf8_str_new_cstr("arena_stats"));
    if (NIL_P(arena_stats)) { arena_stats = rb_hash_lookup(options, ID2SYM(rb_intern("arena_stats"))); }
    if (!NIL_P(arena_stats) && RTEST(arena_stats)) { print_arena_stats = true; }
  }

  parse_args_T args = { 0 };
  args.source = source;
  args.parser_options = &parser_options;

  if (!hb_allocator_init(&args.allocator, HB_ALLOCATOR_ARENA)) { return Qnil; }

  args.root = herb_parse(string, &parser_options, &args.allocator);

  if (print_arena_stats) { hb_arena_print_stats((hb_arena_T*) args.allocator.context); }

  return rb_ensure(parse_convert_body, (VALUE) &args, parse_cleanup, (VALUE) &args);
}

static VALUE Herb_extract_ruby(int argc, VALUE* argv, VALUE self) {
  VALUE source, options;
  rb_scan_args(argc, argv, "1:", &source, &options);

  char* string = (char*) check_string(source);

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) { return Qnil; }

  hb_buffer_T output;
  if (!hb_buffer_init(&output, strlen(string), &allocator)) { return Qnil; }

  herb_extract_ruby_options_T extract_options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;

  if (!NIL_P(options)) {
    VALUE semicolons_value = rb_hash_lookup(options, rb_utf8_str_new_cstr("semicolons"));
    if (NIL_P(semicolons_value)) { semicolons_value = rb_hash_lookup(options, ID2SYM(rb_intern("semicolons"))); }
    if (!NIL_P(semicolons_value)) { extract_options.semicolons = RTEST(semicolons_value); }

    VALUE comments_value = rb_hash_lookup(options, rb_utf8_str_new_cstr("comments"));
    if (NIL_P(comments_value)) { comments_value = rb_hash_lookup(options, ID2SYM(rb_intern("comments"))); }
    if (!NIL_P(comments_value)) { extract_options.comments = RTEST(comments_value); }

    VALUE preserve_positions_value = rb_hash_lookup(options, rb_utf8_str_new_cstr("preserve_positions"));
    if (NIL_P(preserve_positions_value)) {
      preserve_positions_value = rb_hash_lookup(options, ID2SYM(rb_intern("preserve_positions")));
    }
    if (!NIL_P(preserve_positions_value)) { extract_options.preserve_positions = RTEST(preserve_positions_value); }
  }

  herb_extract_ruby_to_buffer_with_options(string, &output, &extract_options, &allocator);

  buffer_args_T args = { .buffer_value = output.value, .allocator = allocator };

  return rb_ensure(buffer_to_string_body, (VALUE) &args, buffer_cleanup, (VALUE) &args);
}

static VALUE Herb_extract_html(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) { return Qnil; }

  hb_buffer_T output;
  if (!hb_buffer_init(&output, strlen(string), &allocator)) { return Qnil; }

  herb_extract_html_to_buffer(string, &output, &allocator);

  buffer_args_T args = { .buffer_value = output.value, .allocator = allocator };

  return rb_ensure(buffer_to_string_body, (VALUE) &args, buffer_cleanup, (VALUE) &args);
}

static VALUE Herb_arena_stats(int argc, VALUE* argv, VALUE self) {
  VALUE source, options;
  rb_scan_args(argc, argv, "1:", &source, &options);

  char* string = (char*) check_string(source);

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;

  if (!NIL_P(options)) {
    VALUE track_whitespace = rb_hash_lookup(options, rb_utf8_str_new_cstr("track_whitespace"));
    if (NIL_P(track_whitespace)) { track_whitespace = rb_hash_lookup(options, ID2SYM(rb_intern("track_whitespace"))); }
    if (!NIL_P(track_whitespace) && RTEST(track_whitespace)) { parser_options.track_whitespace = true; }

    VALUE analyze = rb_hash_lookup(options, rb_utf8_str_new_cstr("analyze"));
    if (NIL_P(analyze)) { analyze = rb_hash_lookup(options, ID2SYM(rb_intern("analyze"))); }
    if (!NIL_P(analyze) && !RTEST(analyze)) { parser_options.analyze = false; }

    VALUE strict = rb_hash_lookup(options, rb_utf8_str_new_cstr("strict"));
    if (NIL_P(strict)) { strict = rb_hash_lookup(options, ID2SYM(rb_intern("strict"))); }
    if (!NIL_P(strict)) { parser_options.strict = RTEST(strict); }
  }

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) { return Qnil; }

  AST_DOCUMENT_NODE_T* root = herb_parse(string, &parser_options, &allocator);

  hb_arena_stats_T stats = hb_arena_get_stats((hb_arena_T*) allocator.context);

  if (root != NULL) { ast_node_free((AST_NODE_T*) root, &allocator); }
  hb_allocator_destroy(&allocator);

  VALUE hash = rb_hash_new();
  rb_hash_aset(hash, ID2SYM(rb_intern("pages")), SIZET2NUM(stats.pages));
  rb_hash_aset(hash, ID2SYM(rb_intern("total_capacity")), SIZET2NUM(stats.total_capacity));
  rb_hash_aset(hash, ID2SYM(rb_intern("total_used")), SIZET2NUM(stats.total_used));
  rb_hash_aset(hash, ID2SYM(rb_intern("total_available")), SIZET2NUM(stats.total_available));
  rb_hash_aset(hash, ID2SYM(rb_intern("allocations")), SIZET2NUM(stats.allocations));
  rb_hash_aset(hash, ID2SYM(rb_intern("fragmentation")), SIZET2NUM(stats.fragmentation));
  rb_hash_aset(hash, ID2SYM(rb_intern("default_page_size")), SIZET2NUM(stats.default_page_size));

  return hash;
}

static VALUE make_tracking_hash(hb_allocator_tracking_stats_T* stats) {
  VALUE hash = rb_hash_new();
  rb_hash_aset(hash, ID2SYM(rb_intern("allocations")), SIZET2NUM(stats->allocation_count));
  rb_hash_aset(hash, ID2SYM(rb_intern("deallocations")), SIZET2NUM(stats->deallocation_count));
  rb_hash_aset(hash, ID2SYM(rb_intern("bytes_allocated")), SIZET2NUM(stats->bytes_allocated));
  rb_hash_aset(hash, ID2SYM(rb_intern("bytes_deallocated")), SIZET2NUM(stats->bytes_deallocated));
  rb_hash_aset(hash, ID2SYM(rb_intern("untracked_deallocations")), SIZET2NUM(stats->untracked_deallocation_count));

  VALUE leaks = rb_ary_new();
  for (size_t i = 0; i < stats->buckets_capacity; i++) {
    if (stats->buckets[i].pointer != NULL && stats->buckets[i].pointer != (void*) 1) {
      rb_ary_push(leaks, SIZET2NUM(stats->buckets[i].size));
    }
  }
  rb_hash_aset(hash, ID2SYM(rb_intern("leaks")), leaks);

  VALUE untracked = rb_ary_new_capa((long) stats->untracked_pointers_size);
  for (size_t i = 0; i < stats->untracked_pointers_size; i++) {
    rb_ary_push(untracked, rb_sprintf("%p", stats->untracked_pointers[i]));
  }
  rb_hash_aset(hash, ID2SYM(rb_intern("untracked_pointers")), untracked);

  return hash;
}

static VALUE Herb_leak_check(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  VALUE result = rb_hash_new();

  {
    hb_allocator_T allocator;
    if (!hb_allocator_init(&allocator, HB_ALLOCATOR_TRACKING)) { return Qnil; }

    hb_array_T* tokens = herb_lex(string, &allocator);
    if (tokens != NULL) { herb_free_tokens(&tokens, &allocator); }

    hb_allocator_tracking_stats_T* stats = hb_allocator_tracking_stats(&allocator);
    rb_hash_aset(result, ID2SYM(rb_intern("lex")), make_tracking_hash(stats));

    hb_allocator_destroy(&allocator);
  }

  {
    hb_allocator_T allocator;
    if (!hb_allocator_init(&allocator, HB_ALLOCATOR_TRACKING)) { return Qnil; }

    parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;
    AST_DOCUMENT_NODE_T* root = herb_parse(string, &parser_options, &allocator);
    if (root != NULL) { ast_node_free((AST_NODE_T*) root, &allocator); }

    hb_allocator_tracking_stats_T* stats = hb_allocator_tracking_stats(&allocator);
    rb_hash_aset(result, ID2SYM(rb_intern("parse")), make_tracking_hash(stats));

    hb_allocator_destroy(&allocator);
  }

  {
    hb_allocator_T allocator;
    if (!hb_allocator_init(&allocator, HB_ALLOCATOR_TRACKING)) { return Qnil; }

    hb_buffer_T output;
    if (!hb_buffer_init(&output, strlen(string), &allocator)) { return Qnil; }

    herb_extract_ruby_options_T extract_options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;
    herb_extract_ruby_to_buffer_with_options(string, &output, &extract_options, &allocator);

    hb_allocator_tracking_stats_T* stats = hb_allocator_tracking_stats(&allocator);
    rb_hash_aset(result, ID2SYM(rb_intern("extract_ruby")), make_tracking_hash(stats));

    hb_buffer_free(&output);
    hb_allocator_destroy(&allocator);
  }

  {
    hb_allocator_T allocator;
    if (!hb_allocator_init(&allocator, HB_ALLOCATOR_TRACKING)) { return Qnil; }

    hb_buffer_T output;
    if (!hb_buffer_init(&output, strlen(string), &allocator)) { return Qnil; }

    herb_extract_html_to_buffer(string, &output, &allocator);

    hb_allocator_tracking_stats_T* stats = hb_allocator_tracking_stats(&allocator);
    rb_hash_aset(result, ID2SYM(rb_intern("extract_html")), make_tracking_hash(stats));

    hb_buffer_free(&output);
    hb_allocator_destroy(&allocator);
  }

  return result;
}

static VALUE Herb_version(VALUE self) {
  VALUE gem_version = rb_const_get(self, rb_intern("VERSION"));
  VALUE libherb_version = rb_utf8_str_new_cstr(herb_version());
  VALUE libprism_version = rb_utf8_str_new_cstr(herb_prism_version());

#ifdef HERB_GIT_BUILD
#  ifdef HERB_GIT_SHA
  VALUE format_string = rb_utf8_str_new_cstr(
    "herb gem " HERB_GIT_SHA ", libprism v%s, libherb " HERB_GIT_SHA " (Ruby C native extension, built from source)"
  );

  return rb_funcall(rb_mKernel, rb_intern("sprintf"), 2, format_string, libprism_version);
#  else
  VALUE format_string =
    rb_utf8_str_new_cstr("herb gem v%s, libprism v%s, libherb v%s (Ruby C native extension, built from source)");

  return rb_funcall(rb_mKernel, rb_intern("sprintf"), 4, format_string, gem_version, libprism_version, libherb_version);
#  endif
#else
  return rb_funcall(
    rb_mKernel,
    rb_intern("sprintf"),
    4,
    rb_utf8_str_new_cstr("herb gem v%s, libprism v%s, libherb v%s (Ruby C native extension)"),
    gem_version,
    libprism_version,
    libherb_version
  );
#endif
}

typedef struct {
  AST_DOCUMENT_NODE_T* old_root;
  AST_DOCUMENT_NODE_T* new_root;
  herb_diff_result_T* diff_result;
  hb_allocator_T old_allocator;
  hb_allocator_T new_allocator;
  hb_allocator_T diff_allocator;
} diff_args_T;

static VALUE rb_create_diff_operation(const herb_diff_operation_T* operation) {
  VALUE cDiffOperation = rb_const_get(mHerb, rb_intern("DiffOperation"));

  VALUE type = ID2SYM(rb_intern(herb_diff_operation_type_to_string(operation->type)));

  VALUE path_array = rb_ary_new_capa(operation->path.depth);
  for (uint16_t index = 0; index < operation->path.depth; index++) {
    rb_ary_push(path_array, UINT2NUM(operation->path.indices[index]));
  }

  VALUE old_node = operation->old_node != NULL ? rb_node_from_c_struct((AST_NODE_T*) operation->old_node) : Qnil;
  VALUE new_node = operation->new_node != NULL ? rb_node_from_c_struct((AST_NODE_T*) operation->new_node) : Qnil;

  return rb_funcall(
    cDiffOperation,
    rb_intern("new"),
    6,
    type,
    path_array,
    old_node,
    new_node,
    UINT2NUM(operation->old_index),
    UINT2NUM(operation->new_index)
  );
}

static VALUE diff_convert_body(VALUE arg) {
  diff_args_T* args = (diff_args_T*) arg;
  herb_diff_result_T* diff_result = args->diff_result;

  VALUE cDiffResult = rb_const_get(mHerb, rb_intern("DiffResult"));

  size_t operation_count = herb_diff_operation_count(diff_result);
  VALUE operations_array = rb_ary_new_capa((long) operation_count);

  for (size_t index = 0; index < operation_count; index++) {
    const herb_diff_operation_T* operation = herb_diff_operation_at(diff_result, index);
    rb_ary_push(operations_array, rb_create_diff_operation(operation));
  }

  VALUE result_args[] = { diff_result->trees_identical ? Qtrue : Qfalse, operations_array };

  return rb_class_new_instance(2, result_args, cDiffResult);
}

static VALUE diff_cleanup(VALUE arg) {
  diff_args_T* args = (diff_args_T*) arg;

  if (args->old_root != NULL) { ast_node_free((AST_NODE_T*) args->old_root, &args->old_allocator); }
  if (args->new_root != NULL) { ast_node_free((AST_NODE_T*) args->new_root, &args->new_allocator); }

  hb_allocator_destroy(&args->diff_allocator);
  hb_allocator_destroy(&args->old_allocator);
  hb_allocator_destroy(&args->new_allocator);

  return Qnil;
}

static VALUE Herb_diff(int argc, VALUE* argv, VALUE self) {
  VALUE old_source, new_source;
  rb_scan_args(argc, argv, "2", &old_source, &new_source);

  char* old_string = (char*) check_string(old_source);
  char* new_string = (char*) check_string(new_source);

  diff_args_T args = { 0 };

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;

  if (!hb_allocator_init(&args.old_allocator, HB_ALLOCATOR_ARENA)) { return Qnil; }

  if (!hb_allocator_init(&args.new_allocator, HB_ALLOCATOR_ARENA)) {
    hb_allocator_destroy(&args.old_allocator);

    return Qnil;
  }

  if (!hb_allocator_init(&args.diff_allocator, HB_ALLOCATOR_ARENA)) {
    hb_allocator_destroy(&args.old_allocator);
    hb_allocator_destroy(&args.new_allocator);

    return Qnil;
  }

  args.old_root = herb_parse(old_string, &parser_options, &args.old_allocator);
  args.new_root = herb_parse(new_string, &parser_options, &args.new_allocator);

  if (args.old_root == NULL || args.new_root == NULL) {
    diff_cleanup((VALUE) &args);

    return Qnil;
  }

  args.diff_result = herb_diff(args.old_root, args.new_root, &args.diff_allocator);

  return rb_ensure(diff_convert_body, (VALUE) &args, diff_cleanup, (VALUE) &args);
}

__attribute__((__visibility__("default"))) void Init_herb(void) {
  mHerb = rb_define_module("Herb");
  cPosition = rb_define_class_under(mHerb, "Position", rb_cObject);
  cLocation = rb_define_class_under(mHerb, "Location", rb_cObject);
  cRange = rb_define_class_under(mHerb, "Range", rb_cObject);
  cToken = rb_define_class_under(mHerb, "Token", rb_cObject);
  cResult = rb_define_class_under(mHerb, "Result", rb_cObject);
  cLexResult = rb_define_class_under(mHerb, "LexResult", cResult);
  cParseResult = rb_define_class_under(mHerb, "ParseResult", cResult);
  cParserOptions = rb_define_class_under(mHerb, "ParserOptions", rb_cObject);

  rb_init_node_classes();
  rb_init_error_classes();

  rb_define_singleton_method(mHerb, "parse", Herb_parse, -1);
  rb_define_singleton_method(mHerb, "lex", Herb_lex, -1);
  rb_define_singleton_method(mHerb, "extract_ruby", Herb_extract_ruby, -1);
  rb_define_singleton_method(mHerb, "extract_html", Herb_extract_html, 1);
  rb_define_singleton_method(mHerb, "arena_stats", Herb_arena_stats, -1);
  rb_define_singleton_method(mHerb, "leak_check", Herb_leak_check, 1);
  rb_define_singleton_method(mHerb, "version", Herb_version, 0);
  rb_define_singleton_method(mHerb, "diff", Herb_diff, -1);
}
