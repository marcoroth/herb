#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "extension_helpers.h"

extern "C" {
#include "../src/include/analyze.h"
#include "../src/include/macros.h"
#include "../src/include/util/hb_arena.h"
#include "../src/include/util/hb_array.h"
#include "../src/include/ast_node.h"
#include "../src/include/ast_nodes.h"
#include "../src/include/ast_pretty_print.h"
#include "../src/include/util/hb_buffer.h"
#include "../src/include/extract.h"
#include "../src/include/herb.h"
#include "../src/include/location.h"
#include "../src/include/position.h"
#include "../src/include/pretty_print.h"
#include "../src/include/range.h"
#include "../src/include/token.h"
}

using namespace emscripten;

val Herb_lex(const std::string& source) {
  hb_arena_T* arena = (hb_arena_T*) malloc(sizeof(hb_arena_T));

  if (!arena) {
    return val::null();
  }

  if (!hb_arena_init(arena, KB(512))) {
    free(arena);
    return val::null();
  }

  herb_lex_result_T* lex_result = herb_lex(source.c_str(), arena);

  if (!lex_result) {
    hb_arena_free(arena);
    free(arena);
    return val::null();
  }

  val result = CreateLexResult(lex_result->tokens, source);

  herb_free_lex_result(&lex_result);

  return result;
}

val Herb_parse(const std::string& source, val options) {
  parser_options_T* parser_options = nullptr;
  parser_options_T opts = {0};

  if (!options.isUndefined() && !options.isNull() && options.typeOf().as<std::string>() == "object") {
    if (options.hasOwnProperty("track_whitespace")) {
      bool track_whitespace = options["track_whitespace"].as<bool>();
      if (track_whitespace) {
        opts.track_whitespace = true;
        parser_options = &opts;
      }
    }
  }

  hb_arena_T* arena = (hb_arena_T*) malloc(sizeof(hb_arena_T));

  if (!arena) {
    return val::null();
  }

  if (!hb_arena_init(arena, KB(512))) {
    free(arena);
    return val::null();
  }

  AST_DOCUMENT_NODE_T* root = herb_parse(source.c_str(), parser_options, arena);

  if (!root) {
    hb_arena_free(arena);
    free(arena);
    return val::null();
  }

  herb_analyze_parse_tree(root, source.c_str());

  val result = CreateParseResult(root, source);

  ast_node_free((AST_NODE_T *) root);

  return result;
}

std::string Herb_extract_ruby(const std::string& source) {
  hb_buffer_T output;
  hb_buffer_init(&output, source.length());

  herb_extract_ruby_to_buffer(source.c_str(), &output);
  std::string result(hb_buffer_value(&output));
  free(output.value);
  return result;
}

std::string Herb_extract_html(const std::string& source) {
  hb_buffer_T output;
  hb_buffer_init(&output, source.length());

  herb_extract_html_to_buffer(source.c_str(), &output);
  std::string result(hb_buffer_value(&output));
  free(output.value);
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
