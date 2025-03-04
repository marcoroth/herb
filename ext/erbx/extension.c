#include <ruby.h>

#include "extension.h"
#include "extension_helpers.h"
#include "nodes.h"

#include "../../src/include/ast_pretty_print.h"
#include "../../src/include/erbx.h"
#include "../../src/include/token.h"

VALUE LexResult;
VALUE ParseResult;

static VALUE ERBX_lex(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  array_T* tokens = erbx_lex(string);

  VALUE value = rb_ary_new();
  VALUE warnings = rb_ary_new();
  VALUE errors = rb_ary_new();

  for (size_t i = 0; i < array_size(tokens); i++) {
    token_T* token = array_get(tokens, i);

    if (token != NULL) { rb_ary_push(value, rb_token_from_c_struct(token)); }
  }

  erbx_free_tokens(&tokens);

  VALUE args[4] = { value, source, warnings, errors };

  return rb_class_new_instance(4, args, LexResult);
}

static VALUE ERBX_parse(VALUE self, VALUE source) {
  buffer_T output;

  if (!buffer_init(&output)) { return Qnil; }

  char* string = (char*) check_string(source);

  AST_DOCUMENT_NODE_T* root = erbx_parse(string);

  VALUE value = rb_node_from_c_struct((AST_NODE_T*) root);
  VALUE warnings = rb_ary_new();
  VALUE errors = rb_ary_new();

  if (root) {
    ast_pretty_print_node((AST_NODE_T*) root, 0, 0, &output);
    ast_node_free((AST_NODE_T*) root);
  }

  buffer_free(&output);

  VALUE args[4] = { value, source, warnings, errors };

  return rb_class_new_instance(4, args, ParseResult);
}

void Init_erbx(void) {
  VALUE ERBX = rb_define_module("ERBX");
  VALUE Result = rb_define_class_under(ERBX, "Result", rb_cObject);

  LexResult = rb_define_class_under(ERBX, "LexResult", Result);
  ParseResult = rb_define_class_under(ERBX, "ParseResult", Result);

  rb_define_singleton_method(ERBX, "parse", ERBX_parse, 1);
  rb_define_singleton_method(ERBX, "lex", ERBX_lex, 1);
}
