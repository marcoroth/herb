#include "extension.h"
#include <ruby.h>

#include "../../src/include/erbx.h"
#include "../../src/include/token.h"

VALUE ERBX;
VALUE Node;
VALUE Token;
VALUE Location;
VALUE Range;
VALUE ParseResult;

static const char* check_string(VALUE value) {
  if (NIL_P(value)) { return NULL; }

  if (!RB_TYPE_P(value, T_STRING)) {
    rb_raise(rb_eTypeError, "wrong argument type %" PRIsVALUE " (expected String)", rb_obj_class(value));
  }

  return RSTRING_PTR(value);
}

static VALUE rb_location_from_c_struct(location_T* location) {
  if (!location) { return Qnil; }

  VALUE args[2];
  args[0] = SIZET2NUM(location->line);
  args[1] = SIZET2NUM(location->column);

  return rb_class_new_instance(2, args, Location);
}

static VALUE rb_range_from_c_struct(range_T* range) {
  if (!range) { return Qnil; }

  VALUE args[2];
  args[0] = SIZET2NUM(range->start);
  args[1] = SIZET2NUM(range->end);

  return rb_class_new_instance(2, args, Range);
}

static VALUE rb_token_from_c_struct(token_T* token) {
  if (!token) { return Qnil; }

  VALUE value = token->value ? rb_str_new_cstr(token->value) : Qnil;

  VALUE range = rb_range_from_c_struct(token->range);
  VALUE start = rb_location_from_c_struct(token->start);
  VALUE end = rb_location_from_c_struct(token->end);
  VALUE type = rb_str_new_cstr(token_type_to_string(token->type));

  VALUE args[5] = { value, range, start, end, type };
  return rb_class_new_instance(5, args, Token);
}

static VALUE rb_node_from_c_struct(AST_NODE_T* node) {
  if (!node) { return Qnil; }

  VALUE type = rb_str_new_cstr(ast_node_type_to_string(node));
  VALUE children = rb_ary_new();

  if (node->children) {
    for (size_t i = 0; i < array_size(node->children); i++) {
      AST_NODE_T* child = (AST_NODE_T*) array_get(node->children, i);

      if (child) {
        VALUE rb_child = rb_node_from_c_struct(child);
        rb_ary_push(children, rb_child);
      }
    }
  }

  VALUE start_loc = rb_location_from_c_struct(node->start);
  VALUE end_loc = rb_location_from_c_struct(node->end);

  VALUE args[4] = { type, children, start_loc, end_loc };

  return rb_class_new_instance(4, args, Node);
}

static VALUE ERBX_lex(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  array_T* tokens = erbx_lex(string);

  VALUE result = rb_ary_new();

  for (size_t i = 0; i < array_size(tokens); i++) {
    token_T* token = array_get(tokens, i);

    if (token != NULL) { rb_ary_push(result, rb_token_from_c_struct(token)); }
  }

  erbx_free_tokens(&tokens);

  return result;
}

static VALUE ERBX_parse(VALUE self, VALUE source) {
  buffer_T output;

  if (!buffer_init(&output)) { return Qnil; }

  char* string = (char*) check_string(source);

  AST_HTML_DOCUMENT_NODE_T* root = erbx_parse(string);

  VALUE result = rb_node_from_c_struct((AST_NODE_T*) root);

  if (root) {
    ast_node_pretty_print((AST_NODE_T*) root, 0, 0, &output);
    printf("%s\n", output.value);

    ast_node_free((AST_NODE_T*) root);
  }

  buffer_free(&output);

  return result;
}

void Init_erbx(void) {
  ERBX = rb_define_module("ERBX");
  Node = rb_define_class_under(ERBX, "Node", rb_cObject);
  Token = rb_define_class_under(ERBX, "Token", rb_cObject);
  Location = rb_define_class_under(ERBX, "Location", rb_cObject);
  Range = rb_define_class_under(ERBX, "Range", rb_cObject);
  ParseResult = rb_define_class_under(ERBX, "ParseResult", rb_cObject);

  rb_define_singleton_method(ERBX, "parse", ERBX_parse, 1);
  rb_define_singleton_method(ERBX, "lex", ERBX_lex, 1);
}
