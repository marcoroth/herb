#include <ruby.h>

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

void Init_native_backend(void);

void Init_herb(void) {
  mHerb = rb_define_module("Herb");
  cPosition = rb_define_class_under(mHerb, "Position", rb_cObject);
  cLocation = rb_define_class_under(mHerb, "Location", rb_cObject);
  cRange = rb_define_class_under(mHerb, "Range", rb_cObject);
  cToken = rb_define_class_under(mHerb, "Token", rb_cObject);
  cResult = rb_define_class_under(mHerb, "Result", rb_cObject);
  cLexResult = rb_define_class_under(mHerb, "LexResult", cResult);
  cParseResult = rb_define_class_under(mHerb, "ParseResult", cResult);

  Init_native_backend();
}
