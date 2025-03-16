extern "C" {
#include "../extension/libherb/include/analyze.h"
#include "../extension/libherb/include/array.h"
#include "../extension/libherb/include/ast_nodes.h"
#include "../extension/libherb/include/buffer.h"
#include "../extension/libherb/include/herb.h"
#include "../extension/libherb/include/location.h"
#include "../extension/libherb/include/range.h"
#include "../extension/libherb/include/token.h"
}

#include "error_helpers.h"
#include "extension_helpers.h"
#include "nodes.h"

#include <node_api.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

napi_value Herb_lex(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    napi_throw_error(env, nullptr, "Wrong number of arguments");
    return nullptr;
  }

  char* string = CheckString(env, args[0]);
  if (!string) { return nullptr; }

  array_T* tokens = herb_lex(string);
  napi_value result = CreateLexResult(env, tokens, args[0]);

  free(string);
  return result;
}

napi_value Herb_lex_file(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    napi_throw_error(env, nullptr, "Wrong number of arguments");
    return nullptr;
  }

  char* file_path = CheckString(env, args[0]);
  if (!file_path) { return nullptr; }

  array_T* tokens = herb_lex_file(file_path);
  napi_value source_value = ReadFileToString(env, file_path);
  napi_value result = CreateLexResult(env, tokens, source_value);

  free(file_path);
  return result;
}

napi_value Herb_parse(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    napi_throw_error(env, nullptr, "Wrong number of arguments");
    return nullptr;
  }

  char* string = CheckString(env, args[0]);
  if (!string) { return nullptr; }

  AST_DOCUMENT_NODE_T* root = herb_parse(string);
  herb_analyze_parse_tree(root, string);
  napi_value result = CreateParseResult(env, root, args[0]);

  free(string);
  return result;
}

napi_value Herb_parse_file(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    napi_throw_error(env, nullptr, "Wrong number of arguments");
    return nullptr;
  }

  char* file_path = CheckString(env, args[0]);
  if (!file_path) { return nullptr; }

  napi_value source_value = ReadFileToString(env, file_path);

  char* string = CheckString(env, source_value);
  if (!string) {
    free(file_path);
    return nullptr;
  }

  AST_DOCUMENT_NODE_T* root = herb_parse(string);
  napi_value result = CreateParseResult(env, root, source_value);

  free(file_path);
  free(string);
  return result;
}

napi_value Herb_lex_to_json(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    napi_throw_error(env, nullptr, "Wrong number of arguments");
    return nullptr;
  }

  char* string = CheckString(env, args[0]);
  if (!string) { return nullptr; }

  buffer_T output;
  if (!buffer_init(&output)) {
    free(string);
    napi_throw_error(env, nullptr, "Failed to initialize buffer");
    return nullptr;
  }

  herb_lex_json_to_buffer(string, &output);

  napi_value result;
  napi_create_string_utf8(env, output.value, output.length, &result);

  buffer_free(&output);
  free(string);
  return result;
}

napi_value Herb_extract_ruby(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    napi_throw_error(env, nullptr, "Wrong number of arguments");
    return nullptr;
  }

  char* string = CheckString(env, args[0]);
  if (!string) { return nullptr; }

  buffer_T output;
  if (!buffer_init(&output)) {
    free(string);
    napi_throw_error(env, nullptr, "Failed to initialize buffer");
    return nullptr;
  }

  herb_extract_ruby_to_buffer(string, &output);

  napi_value result;
  napi_create_string_utf8(env, output.value, NAPI_AUTO_LENGTH, &result);

  buffer_free(&output);
  free(string);
  return result;
}

napi_value Herb_extract_html(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    napi_throw_error(env, nullptr, "Wrong number of arguments");
    return nullptr;
  }

  char* string = CheckString(env, args[0]);
  if (!string) { return nullptr; }

  buffer_T output;
  if (!buffer_init(&output)) {
    free(string);
    napi_throw_error(env, nullptr, "Failed to initialize buffer");
    return nullptr;
  }

  herb_extract_html_to_buffer(string, &output);

  napi_value result;
  napi_create_string_utf8(env, output.value, NAPI_AUTO_LENGTH, &result);

  buffer_free(&output);
  free(string);
  return result;
}

napi_value Herb_version(napi_env env, napi_callback_info info) {
  const char* native_version = herb_version();

  char version_buf[256];
  snprintf(version_buf, sizeof(version_buf), "libherb@%s (Node.js C++ native extension)", native_version);

  napi_value result;
  napi_create_string_utf8(env, version_buf, NAPI_AUTO_LENGTH, &result);

  return result;
}

napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor descriptors[] = {
    { "parse", nullptr, Herb_parse, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "lex", nullptr, Herb_lex, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "parseFile", nullptr, Herb_parse_file, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "lexFile", nullptr, Herb_lex_file, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "lexToJson", nullptr, Herb_lex_to_json, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "extractRuby", nullptr, Herb_extract_ruby, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "extractHTML", nullptr, Herb_extract_html, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "version", nullptr, Herb_version, nullptr, nullptr, nullptr, napi_default, nullptr },
  };

  napi_define_properties(env, exports, sizeof(descriptors) / sizeof(descriptors[0]), descriptors);

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
