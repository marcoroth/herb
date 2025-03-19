#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "extension_helpers.h"

extern "C" {
#include "../src/include/array.h"
#include "../src/include/ast_node.h"
#include "../src/include/ast_nodes.h"
#include "../src/include/pretty_print.h"
#include "../src/include/ast_pretty_print.h"
#include "../src/include/buffer.h"
#include "../src/include/herb.h"
#include "../src/include/token.h"
#include "../src/include/position.h"
#include "../src/include/location.h"
#include "../src/include/range.h"
#include "../src/include/extract.h"
}

using namespace emscripten;

val Herb_lex(const std::string& source) {
  array_T* tokens = herb_lex(source.c_str());

  val result = CreateLexResult(tokens, source);

  return result;
}

val Herb_parse(const std::string& source) {
  AST_DOCUMENT_NODE_T* root = herb_parse(source.c_str());

  return CreateParseResult(root, source);
}

std::string Herb_extract_ruby(const std::string& source) {
  buffer_T output;
  buffer_init(&output);
  herb_extract_ruby_to_buffer(source.c_str(), &output);
  std::string result(buffer_value(&output));
  buffer_free(&output);
  return result;
}

std::string Herb_extract_html(const std::string& source) {
  buffer_T output;
  buffer_init(&output);
  herb_extract_html_to_buffer(source.c_str(), &output);
  std::string result(buffer_value(&output));
  buffer_free(&output);
  return result;
}

std::string Herb_version() {
  const char* libherb_version = herb_version();
  const char* libprism_version = herb_prism_version();

  std::string version = std::string("libprism@") + libprism_version + ", libherb@" + libherb_version + " (WebAssembly)";
  return version;
}

EMSCRIPTEN_BINDINGS(herb_module) {
  function("lex", &Herb_lex);
  function("parse", &Herb_parse);
  function("extractRuby", &Herb_extract_ruby);
  function("extractHTML", &Herb_extract_html);
  function("version", &Herb_version);
}
