#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "extension_helpers.h"

extern "C" {
#include "../src/include/lib/hb_allocator.h"
#include "../src/include/lib/hb_array.h"
#include "../src/include/ast/ast_node.h"
#include "../src/include/ast/ast_nodes.h"
#include "../src/include/ast/ast_pretty_print.h"
#include "../src/include/lib/hb_buffer.h"
#include "../src/include/extract.h"
#include "../src/include/herb.h"
#include "../src/include/location/location.h"
#include "../src/include/location/position.h"
#include "../src/include/ast/pretty_print.h"
#include "../src/include/location/range.h"
#include "../src/include/lexer/token.h"
}

using namespace emscripten;

val Herb_lex(const std::string& source) {
  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) {
    return val::null();
  }

  hb_array_T* tokens = herb_lex(source.c_str(), &allocator);

  val result = CreateLexResult(tokens, source);

  herb_free_tokens(&tokens, &allocator);
  hb_allocator_destroy(&allocator);

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

    if (options.hasOwnProperty("action_view_helpers")) {
      parser_options.action_view_helpers = options["action_view_helpers"].as<bool>();
    }

    if (options.hasOwnProperty("transform_conditionals")) {
      parser_options.transform_conditionals = options["transform_conditionals"].as<bool>();
    }

    if (options.hasOwnProperty("render_nodes")) {
      parser_options.render_nodes = options["render_nodes"].as<bool>();
    }

    if (options.hasOwnProperty("strict_locals")) {
      parser_options.strict_locals = options["strict_locals"].as<bool>();
    }

    if (options.hasOwnProperty("prism_nodes")) {
      parser_options.prism_nodes = options["prism_nodes"].as<bool>();
    }

    if (options.hasOwnProperty("prism_nodes_deep")) {
      parser_options.prism_nodes_deep = options["prism_nodes_deep"].as<bool>();
    }

    if (options.hasOwnProperty("prism_program")) {
      parser_options.prism_program = options["prism_program"].as<bool>();
    }

    if (options.hasOwnProperty("dot_notation_tags")) {
      parser_options.dot_notation_tags = options["dot_notation_tags"].as<bool>();
    }

    if (options.hasOwnProperty("html")) {
      parser_options.html = options["html"].as<bool>();
    }
  }

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) {
    return val::null();
  }

  AST_DOCUMENT_NODE_T* root = herb_parse(source.c_str(), &parser_options, &allocator);

  val result = CreateParseResult(root, source, &parser_options);

  ast_node_free((AST_NODE_T *) root, &allocator);
  hb_allocator_destroy(&allocator);

  return result;
}

std::string Herb_extract_ruby(const std::string& source, val options) {
  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) {
    return std::string();
  }

  hb_buffer_T output;
  hb_buffer_init(&output, source.length(), &allocator);

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

  herb_extract_ruby_to_buffer_with_options(source.c_str(), &output, &extract_options, &allocator);
  std::string result(hb_buffer_value(&output));
  hb_allocator_destroy(&allocator);
  return result;
}

std::string Herb_extract_html(const std::string& source) {
  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) {
    return std::string();
  }

  hb_buffer_T output;
  hb_buffer_init(&output, source.length(), &allocator);

  herb_extract_html_to_buffer(source.c_str(), &output, &allocator);
  std::string result(hb_buffer_value(&output));
  hb_allocator_destroy(&allocator);
  return result;
}

val Herb_parse_ruby(const std::string& source) {
  herb_ruby_parse_result_T* parse_result = herb_parse_ruby(source.c_str(), source.length());

  if (!parse_result) { return val::null(); }

  pm_buffer_t buffer = { 0 };
  pm_serialize(&parse_result->parser, parse_result->root, &buffer);

  val result = val::null();

  if (buffer.length > 0) {
    result = val(typed_memory_view(buffer.length, (const uint8_t*) buffer.value));
    result = val::global("Uint8Array").new_(result);
  }

  pm_buffer_free(&buffer);
  herb_free_ruby_parse_result(parse_result);

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
  function("parseRuby", &Herb_parse_ruby);
}
