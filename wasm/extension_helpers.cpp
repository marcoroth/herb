#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <string>

#include "nodes.h"

extern "C" {
#include "../src/include/util/hb_array.h"
#include "../src/include/ast_node.h"
#include "../src/include/ast_nodes.h"
#include "../src/include/pretty_print.h"
#include "../src/include/ast_pretty_print.h"
#include "../src/include/util/hb_buffer.h"
#include "../src/include/herb.h"
#include "../src/include/token.h"
#include "../src/include/position.h"
#include "../src/include/location.h"
#include "../src/include/range.h"
#include "../src/include/extract.h"
}

using namespace emscripten;

val CreateString(const char* string) {
  return string ? val(string) : val::null();
}

val CreateStringFromHbString(hb_string_T string) {
  if (hb_string_is_empty(string)) {
    return val::null();
  } else {
    std::string cppString(string.data, string.length);

    return val(cppString);
  }
}

val CreatePosition(position_T position) {
  val Object = val::global("Object");
  val result = Object.new_();

  result.set("line", position.line);
  result.set("column", position.column);

  return result;
}

val CreateLocation(location_T location) {
  val Object = val::global("Object");
  val result = Object.new_();

  result.set("start", CreatePosition(location.start));
  result.set("end", CreatePosition(location.end));

  return result;
}

val CreateRange(range_T range) {
  val Array = val::global("Array");
  val result = Array.new_();

  result.call<void>("push", range.from);
  result.call<void>("push", range.to);

  return result;
}

val CreateToken(token_T* token) {
  if (!token) {
    return val::null();
  }

  val Object = val::global("Object");
  val result = Object.new_();

  if (token->value) {
    result.set("value", std::string(token->value));
  } else {
    result.set("value", val::null());
  }

  result.set("type", std::string(token_type_to_string(token->type)));
  result.set("range", CreateRange(token->range));
  result.set("location", CreateLocation(token->location));

  return result;
}

val CreateLexResult(hb_array_T* tokens, const std::string& source) {
  val Object = val::global("Object");
  val Array = val::global("Array");

  val result = Object.new_();
  val tokensArray = Array.new_();
  val errorsArray = Array.new_();
  val warningsArray = Array.new_();

  if (tokens) {
    for (size_t i = 0; i < hb_array_size(tokens); i++) {
      token_T* token = (token_T*)hb_array_get(tokens, i);
      if (token) {
        tokensArray.call<void>("push", CreateToken(token));
      }
    }
  }

  result.set("tokens", tokensArray);
  result.set("source", val(source));
  result.set("warnings", warningsArray);
  result.set("errors", errorsArray);

  return result;
}

val CreateParseResult(AST_DOCUMENT_NODE_T *root, const std::string& source, parser_options_T* options){
  val Object = val::global("Object");
  val Array = val::global("Array");

  val result = Object.new_();
  val value = NodeFromCStruct((AST_NODE_T*)root);
  val errorsArray = Array.new_();
  val warningsArray = Array.new_();

  result.set("value", value);
  result.set("source", val(source));
  result.set("warnings", warningsArray);
  result.set("errors", errorsArray);

  val options_object = Object.new_();
  options_object.set("strict", val(options->strict));
  options_object.set("track_whitespace", val(options->track_whitespace));
  options_object.set("analyze", val(options->analyze));

  result.set("options", options_object);

  return result;
}
