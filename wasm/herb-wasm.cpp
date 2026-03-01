#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "extension_helpers.h"

extern "C" {
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
  hb_array_T* tokens = herb_lex(source.c_str());

  val result = CreateLexResult(tokens, source);

  herb_free_tokens(&tokens);

  return result;
}

val Herb_parse(const std::string& source, val options) {
  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;

  if (!options.isUndefined() && !options.isNull() && options.typeOf().as<std::string>() == "object") {
    if (options.hasOwnProperty("track_whitespace")) {
      bool track_whitespace = options["track_whitespace"].as<bool>();
      if (track_whitespace) {
        parser_options.track_whitespace = true;
      }
    }

    if (options.hasOwnProperty("analyze")) {
      bool analyze = options["analyze"].as<bool>();
      if (!analyze) {
        parser_options.analyze = false;
      }
    }

    if (options.hasOwnProperty("strict")) {
      parser_options.strict = options["strict"].as<bool>();
    }
  }

  AST_DOCUMENT_NODE_T* root = herb_parse(source.c_str(), &parser_options);

  val result = CreateParseResult(root, source, &parser_options);

  ast_node_free((AST_NODE_T *) root);

  return result;
}

std::string Herb_extract_ruby(const std::string& source, val options) {
  hb_buffer_T output;
  hb_buffer_init(&output, source.length());

  herb_extract_ruby_options_T extract_options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;

  if (!options.isUndefined() && !options.isNull() && options.typeOf().as<std::string>() == "object") {
    if (options.hasOwnProperty("semicolons")) {
      extract_options.semicolons = options["semicolons"].as<bool>();
    }

    if (options.hasOwnProperty("comments")) {
      extract_options.comments = options["comments"].as<bool>();
    }

    if (options.hasOwnProperty("preserve_positions")) {
      extract_options.preserve_positions = options["preserve_positions"].as<bool>();
    }
  }

  herb_extract_ruby_to_buffer_with_options(source.c_str(), &output, &extract_options);
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
