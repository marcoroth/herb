#include <ruby.h>
#include <ruby/encoding.h>
#include "include/herb_highlighter.h"

static VALUE rb_mHerb;
static VALUE rb_cHighlighter;
static VALUE rb_eError;
static VALUE rb_eThemeError;

static void highlighter_dfree(void *pointer) {
  if (pointer) herb_highlighter_free(pointer);
}

static size_t highlighter_dsize(const void *pointer) {
  (void) pointer;

  return sizeof(void *);
}

static const rb_data_type_t highlighter_type = {
  .wrap_struct_name = "Herb::Highlighter",
  .function = {
    .dfree = highlighter_dfree,
    .dsize = highlighter_dsize,
  },
  .flags = RUBY_TYPED_FREE_IMMEDIATELY,
};

static VALUE highlighter_alloc(VALUE klass) {
  return TypedData_Wrap_Struct(klass, &highlighter_type, NULL);
}

static VALUE make_utf8_string(const char *cstring) {
  return rb_enc_str_new_cstr(cstring, rb_utf8_encoding());
}

static VALUE take_utf8_string(char *cstring) {
  if (!cstring) return Qnil;

  VALUE string = make_utf8_string(cstring);
  herb_highlighter_string_free(cstring);

  return string;
}

static struct HerbHighlighter *get_highlighter(VALUE self) {
  struct HerbHighlighter *highlighter;
  TypedData_Get_Struct(self, struct HerbHighlighter, &highlighter_type, highlighter);

  if (!highlighter) {
    rb_raise(rb_eError, "highlighter is not initialized");
  }

  return highlighter;
}

static VALUE unwrap_result(HerbHighlighterResult result) {
  if (result.error) {
    VALUE message = make_utf8_string(result.error);
    herb_highlighter_result_free(result);

    rb_raise(rb_eError, "%s", StringValueCStr(message));
  }

  VALUE value = make_utf8_string(result.value ? result.value : "");
  herb_highlighter_result_free(result);

  return value;
}

/* Highlighter.new(theme) */
static VALUE highlighter_initialize(VALUE self, VALUE theme) {
  const char *theme_name = StringValueCStr(theme);

  HerbHighlighterHandle handle = herb_highlighter_new(theme_name);

  if (!handle.highlighter) {
    VALUE message = make_utf8_string(handle.error ? handle.error : "failed to build highlighter");
    herb_highlighter_string_free(handle.error);

    rb_raise(rb_eThemeError, "%s", StringValueCStr(message));
  }

  RTYPEDDATA_DATA(self) = handle.highlighter;

  rb_iv_set(self, "@theme", rb_str_freeze(rb_str_dup(theme)));

  return self;
}

/* highlighter._highlight(path, content, options_json) */
static VALUE highlighter_highlight(VALUE self, VALUE path, VALUE content, VALUE options) {
  return unwrap_result(herb_highlighter_highlight(
    get_highlighter(self),
    StringValueCStr(path),
    StringValueCStr(content),
    StringValueCStr(options)
  ));
}

/* highlighter._highlight_file(path, options_json) */
static VALUE highlighter_highlight_file(VALUE self, VALUE path, VALUE options) {
  return unwrap_result(herb_highlighter_highlight_file(
    get_highlighter(self),
    StringValueCStr(path),
    StringValueCStr(options)
  ));
}

/* highlighter._highlight_diagnostic(path, diagnostic_json, content, options_json) */
static VALUE highlighter_highlight_diagnostic(VALUE self, VALUE path, VALUE diagnostic, VALUE content, VALUE options) {
  return unwrap_result(herb_highlighter_highlight_diagnostic(
    get_highlighter(self),
    StringValueCStr(path),
    StringValueCStr(diagnostic),
    StringValueCStr(content),
    StringValueCStr(options)
  ));
}

/* highlighter._highlight_diff(path, original, modified, options_json) */
static VALUE highlighter_highlight_diff(VALUE self, VALUE path, VALUE original, VALUE modified, VALUE options) {
  return unwrap_result(herb_highlighter_highlight_diff(
    get_highlighter(self),
    StringValueCStr(path),
    StringValueCStr(original),
    StringValueCStr(modified),
    StringValueCStr(options)
  ));
}

/* highlighter._highlight_diff_hunks(path, hunks_json, options_json) */
static VALUE highlighter_highlight_diff_hunks(VALUE self, VALUE path, VALUE hunks, VALUE options) {
  return unwrap_result(herb_highlighter_highlight_diff_hunks(
    get_highlighter(self),
    StringValueCStr(path),
    StringValueCStr(hunks),
    StringValueCStr(options)
  ));
}

/* Highlighter.theme_names → Array[String] */
static VALUE highlighter_s_theme_names(VALUE klass) {
  (void) klass;

  VALUE json = take_utf8_string(herb_highlighter_theme_names());

  return rb_funcall(rb_const_get(rb_cObject, rb_intern("JSON")), rb_intern("parse"), 1, json);
}

/* Highlighter.default_theme → String */
static VALUE highlighter_s_default_theme(VALUE klass) {
  (void) klass;

  return rb_str_freeze(take_utf8_string(herb_highlighter_default_theme()));
}

/* Highlighter.bundled_theme?(name) → true or false */
static VALUE highlighter_s_bundled_theme_p(VALUE klass, VALUE theme) {
  (void) klass;

  return herb_highlighter_valid_theme(StringValueCStr(theme)) ? Qtrue : Qfalse;
}

/* Highlighter.strip_ansi(text) → String */
static VALUE highlighter_s_strip_ansi(VALUE klass, VALUE text) {
  (void) klass;

  VALUE stripped = take_utf8_string(herb_highlighter_strip_ansi(StringValueCStr(text)));

  return NIL_P(stripped) ? rb_str_dup(text) : stripped;
}

/* Highlighter.visible_width(text) → Integer */
static VALUE highlighter_s_visible_width(VALUE klass, VALUE text) {
  (void) klass;

  return SIZET2NUM(herb_highlighter_visible_width(StringValueCStr(text)));
}

/* Highlighter.native_version → String */
static VALUE highlighter_s_native_version(VALUE klass) {
  (void) klass;

  return rb_str_freeze(take_utf8_string(herb_highlighter_version()));
}

void Init_herb_highlighter(void) {
  rb_require("json");

  rb_mHerb = rb_define_module("Herb");
  rb_cHighlighter = rb_define_class_under(rb_mHerb, "Highlighter", rb_cObject);

  rb_eError = rb_define_class_under(rb_cHighlighter, "Error", rb_eStandardError);
  rb_eThemeError = rb_define_class_under(rb_cHighlighter, "ThemeError", rb_eError);

  rb_define_alloc_func(rb_cHighlighter, highlighter_alloc);

  rb_define_private_method(rb_cHighlighter, "_initialize", highlighter_initialize, 1);
  rb_define_private_method(rb_cHighlighter, "_highlight", highlighter_highlight, 3);
  rb_define_private_method(rb_cHighlighter, "_highlight_file", highlighter_highlight_file, 2);
  rb_define_private_method(rb_cHighlighter, "_highlight_diagnostic", highlighter_highlight_diagnostic, 4);
  rb_define_private_method(rb_cHighlighter, "_highlight_diff", highlighter_highlight_diff, 4);
  rb_define_private_method(rb_cHighlighter, "_highlight_diff_hunks", highlighter_highlight_diff_hunks, 3);

  rb_define_singleton_method(rb_cHighlighter, "theme_names", highlighter_s_theme_names, 0);
  rb_define_singleton_method(rb_cHighlighter, "default_theme", highlighter_s_default_theme, 0);
  rb_define_singleton_method(rb_cHighlighter, "bundled_theme?", highlighter_s_bundled_theme_p, 1);
  rb_define_singleton_method(rb_cHighlighter, "strip_ansi", highlighter_s_strip_ansi, 1);
  rb_define_singleton_method(rb_cHighlighter, "visible_width", highlighter_s_visible_width, 1);
  rb_define_singleton_method(rb_cHighlighter, "native_version", highlighter_s_native_version, 0);
}
