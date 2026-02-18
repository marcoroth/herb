#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <string>
#include <vector>

#include "arena.h"
#include "extension_helpers.h"
#include "nodes.h"
#include "parser_options_helpers.h"

extern "C" {
#include "../src/include/lib/hb_allocator.h"
#include "../src/include/lib/hb_array.h"
#include "../src/include/ast/ast_node.h"
#include "../src/include/ast/ast_nodes.h"
#include "../src/include/ast/ast_pretty_print.h"
#include "../src/include/lib/hb_buffer.h"
#include "../src/include/extract.h"
#include "../src/include/herb.h"
#include "../src/include/diff/herb_diff.h"
#include "../src/include/location/location.h"
#include "../src/include/location/position.h"
#include "../src/include/ast/pretty_print.h"
#include "../src/include/location/range.h"
#include "../src/include/lexer/token.h"
}

using namespace emscripten;

static bool HasERBOpeners(val options) {
  if (options.isUndefined() || options.isNull() || options.typeOf().as<std::string>() != "object") {
    return false;
  }

  if (!options.hasOwnProperty("erb_openers")) {
    return false;
  }

  val configured = options["erb_openers"];

  return !configured.isUndefined() && !configured.isNull();
}

static std::vector<std::string> ReadERBOpeners(val options) {
  if (!HasERBOpeners(options)) {
    return std::vector<std::string>();
  }

  return vecFromJSArray<std::string>(options["erb_openers"]);
}

static void ApplyERBOpeners(parser_options_T& parser_options, const std::vector<std::string>& openers, std::vector<hb_string_T>& storage) {
  storage.clear();
  storage.reserve(openers.size());

  for (const std::string& opener : openers) {
    storage.push_back(hb_string_from_data(opener.c_str(), opener.length()));
  }

  parser_options.erb_openers = storage.data();
  parser_options.erb_opener_count = storage.size();
}

static hb_arena_T* ReadArena(val options) {
  if (options.isNull() || options.isUndefined()) { return nullptr; }
  if (!options.hasOwnProperty("arenaId")) { return nullptr; }

  return get_arena_by_id(options["arenaId"].as<int>());
}

static bool InitAllocator(hb_allocator_T& allocator, hb_arena_T* arena) {
  if (arena != nullptr) {
    allocator = hb_allocator_with_borrowed_arena(arena);
    return true;
  }

  return hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);
}

val Herb_lex(const std::string& source, val options) {
  hb_allocator_T allocator;
  if (!InitAllocator(allocator, ReadArena(options))) {
    return val::null();
  }

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;

  std::vector<hb_string_T> opener_storage;
  std::vector<std::string> openers = ReadERBOpeners(options);

  if (HasERBOpeners(options)) {
    ApplyERBOpeners(parser_options, openers, opener_storage);
  }

  hb_array_T* tokens = herb_lex_with_options(source.c_str(), &parser_options, &allocator);

  val result = CreateLexResult(tokens, source);

  herb_free_tokens(&tokens, &allocator);
  hb_allocator_destroy(&allocator);

  return result;
}

val Herb_parse(const std::string& source, val options) {
  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;

  std::vector<std::string> openers = ReadERBOpeners(options);
  std::vector<hb_string_T> opener_storage;

  if (HasERBOpeners(options)) {
    ApplyERBOpeners(parser_options, openers, opener_storage);
  }

  herb_extract_parser_options(options, &parser_options);

  uint32_t error_count = 0;
  parser_options.error_count = &error_count;

  hb_allocator_T allocator;
  if (!InitAllocator(allocator, ReadArena(options))) {
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

  std::vector<std::string> openers = ReadERBOpeners(options);
  std::vector<hb_string_T> opener_storage;

  if (!options.isUndefined() && !options.isNull() && options.typeOf().as<std::string>() == "object") {
    if (HasERBOpeners(options)) {
      opener_storage.reserve(openers.size());

      for (const std::string& opener : openers) {
        opener_storage.push_back(hb_string_from_data(opener.c_str(), opener.length()));
      }

      extract_options.erb_openers = opener_storage.data();
      extract_options.erb_opener_count = opener_storage.size();
    }

    if (options.hasOwnProperty("custom_tags")) {
      extract_options.custom_tags = options["custom_tags"].as<bool>();
    }

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

val Herb_diff(const std::string& old_source, const std::string& new_source, val options) {
  hb_allocator_T old_allocator;
  hb_allocator_T new_allocator;
  hb_allocator_T diff_allocator;

  if (!hb_allocator_init(&old_allocator, HB_ALLOCATOR_ARENA)) {
    return val::null();
  }

  if (!hb_allocator_init(&new_allocator, HB_ALLOCATOR_ARENA)) {
    hb_allocator_destroy(&old_allocator);

    return val::null();
  }

  if (!hb_allocator_init(&diff_allocator, HB_ALLOCATOR_ARENA)) {
    hb_allocator_destroy(&old_allocator);
    hb_allocator_destroy(&new_allocator);

    return val::null();
  }

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;
  herb_diff_options_T diff_options = HERB_DEFAULT_DIFF_OPTIONS;

  if (!options.isUndefined() && !options.isNull() && options.typeOf().as<std::string>() == "object") {
    if (options.hasOwnProperty("track_whitespace_changes")) {
      diff_options.track_whitespace_changes = options["track_whitespace_changes"].as<bool>();
    }
  }

  AST_DOCUMENT_NODE_T* old_root = herb_parse(old_source.c_str(), &parser_options, &old_allocator);
  AST_DOCUMENT_NODE_T* new_root = herb_parse(new_source.c_str(), &parser_options, &new_allocator);

  if (old_root == nullptr || new_root == nullptr) {
    if (old_root != nullptr) { ast_node_free((AST_NODE_T*) old_root, &old_allocator); }
    if (new_root != nullptr) { ast_node_free((AST_NODE_T*) new_root, &new_allocator); }

    hb_allocator_destroy(&diff_allocator);
    hb_allocator_destroy(&old_allocator);
    hb_allocator_destroy(&new_allocator);

    return val::null();
  }

  herb_diff_result_T* diff_result = herb_diff(old_root, new_root, &diff_options, &diff_allocator);

  val result = val::object();
  result.set("identical", diff_result->trees_identical);

  size_t operation_count = herb_diff_operation_count(diff_result);
  val operations = val::array();

  for (size_t index = 0; index < operation_count; index++) {
    const herb_diff_operation_T* operation = herb_diff_operation_at(diff_result, index);

    val operation_object = val::object();
    val path = val::array();

    operation_object.set("type", std::string(herb_diff_operation_type_to_string(operation->type)));

    for (uint16_t path_index = 0; path_index < operation->path.depth; path_index++) {
      path.call<void>("push", operation->path.indices[path_index]);
    }

    operation_object.set("path", path);

    if (operation->old_node != NULL) {
      operation_object.set("oldNode", NodeFromCStruct((AST_NODE_T*) operation->old_node, &HERB_DEFAULT_PARSER_OPTIONS));
    } else {
      operation_object.set("oldNode", val::null());
    }

    if (operation->new_node != NULL) {
      operation_object.set("newNode", NodeFromCStruct((AST_NODE_T*) operation->new_node, &HERB_DEFAULT_PARSER_OPTIONS));
    } else {
      operation_object.set("newNode", val::null());
    }

    operation_object.set("oldIndex", operation->old_index);
    operation_object.set("newIndex", operation->new_index);

    operations.call<void>("push", operation_object);
  }

  result.set("operations", operations);

  ast_node_free((AST_NODE_T*) old_root, &old_allocator);
  ast_node_free((AST_NODE_T*) new_root, &new_allocator);

  hb_allocator_destroy(&diff_allocator);
  hb_allocator_destroy(&old_allocator);
  hb_allocator_destroy(&new_allocator);

  return result;
}

val Herb_default_erb_openings() {
  val openings = val::array();

  for (size_t index = 0; index < HERB_DEFAULT_ERB_OPENINGS_COUNT; index++) {
    hb_string_T opening = HERB_DEFAULT_ERB_OPENINGS[index];

    openings.call<void>("push", std::string(opening.data, opening.length));
  }

  return openings;
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
  function("defaultERBOpenings", &Herb_default_erb_openings);
  function("version", &Herb_version);
  function("parseRuby", &Herb_parse_ruby);
  function("diff", &Herb_diff);

  function("createArena", &Herb_createArena);
  function("resetArena", &Herb_resetArena);
  function("freeArena", &Herb_freeArena);
  function("arenaPosition", &Herb_arenaPosition);
  function("arenaCapacity", &Herb_arenaCapacity);
}
