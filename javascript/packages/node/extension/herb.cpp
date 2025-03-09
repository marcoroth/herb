extern "C" {
#include "../../src/include/herb.h"
#include "../../src/include/array.h"
#include "../../src/include/ast_nodes.h"
#include "../../src/include/buffer.h"
#include "../../src/include/location.h"
#include "../../src/include/range.h"
#include "../../src/include/token.h"
}

#include "error_helpers.h"
#include "extension_helpers.h"
#include "nodes.h"

#include <node_api.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

napi_value CreateString(napi_env env, const char* str) {
  napi_value result;
  napi_create_string_utf8(env, str, NAPI_AUTO_LENGTH, &result);
  return result;
}

char* CheckString(napi_env env, napi_value value) {
  size_t length;
  size_t copied;
  napi_valuetype type;

  napi_typeof(env, value, &type);
  if (type != napi_string) {
    napi_throw_type_error(env, nullptr, "String expected");
    return nullptr;
  }

  napi_get_value_string_utf8(env, value, nullptr, 0, &length);
  char* result = (char*) malloc(length + 1);
  if (!result) {
    napi_throw_error(env, nullptr, "Memory allocation failed");
    return nullptr;
  }

  napi_get_value_string_utf8(env, value, result, length + 1, &copied);
  return result;
}

napi_value ReadFileToString(napi_env env, const char* file_path) {
  FILE* file = fopen(file_path, "r");
  if (!file) {
    napi_throw_error(env, nullptr, "Failed to open file");
    return nullptr;
  }

  fseek(file, 0, SEEK_END);
  long size = ftell(file);
  fseek(file, 0, SEEK_SET);

  char* buffer = (char*) malloc(size + 1);
  if (!buffer) {
    fclose(file);
    napi_throw_error(env, nullptr, "Memory allocation failed");
    return nullptr;
  }

  fread(buffer, 1, size, file);
  buffer[size] = '\0';
  fclose(file);

  napi_value result;
  napi_create_string_utf8(env, buffer, size, &result);
  free(buffer);

  return result;
}

napi_value CreateLexResult(napi_env env, array_T* tokens, napi_value source) {
  napi_value result, tokens_array, errors_array, warnings_array;

  napi_create_object(env, &result);

  napi_set_named_property(env, result, "source", source);

  napi_create_array(env, &tokens_array);
  napi_create_array(env, &errors_array);
  napi_create_array(env, &warnings_array);

  if (tokens && array_size(tokens) > 0) {
    for (size_t i = 0; i < array_size(tokens); i++) {
      token_T* token = (token_T*) array_get(tokens, i);
      if (!token) { continue; }

      napi_value token_obj;
      napi_create_object(env, &token_obj);

      // Value
      napi_value value_prop;
      napi_create_string_utf8(env, token->value, NAPI_AUTO_LENGTH, &value_prop);
      napi_set_named_property(env, token_obj, "value", value_prop);

      // Type
      napi_value type_prop;
      napi_create_string_utf8(env, token_type_to_string(token->type), NAPI_AUTO_LENGTH, &type_prop);
      napi_set_named_property(env, token_obj, "type", type_prop);

      // Range
      napi_value range_arr;
      napi_create_array(env, &range_arr);
      napi_value start_pos, end_pos;
      napi_create_uint32(env, (uint32_t) token->range->from, &start_pos);
      napi_create_uint32(env, (uint32_t) token->range->to, &end_pos);
      napi_set_element(env, range_arr, 0, start_pos);
      napi_set_element(env, range_arr, 1, end_pos);
      napi_set_named_property(env, token_obj, "range", range_arr);

      // Start location
      napi_value start_loc_obj;
      napi_create_object(env, &start_loc_obj);
      napi_value start_line, start_col;
      napi_create_uint32(env, (uint32_t) token->location->start->line, &start_line);
      napi_create_uint32(env, (uint32_t) token->location->start->column, &start_col);
      napi_set_named_property(env, start_loc_obj, "line", start_line);
      napi_set_named_property(env, start_loc_obj, "column", start_col);
      napi_set_named_property(env, token_obj, "start", start_loc_obj);

      // End location
      napi_value end_loc_obj;
      napi_create_object(env, &end_loc_obj);
      napi_value end_line, end_col;
      napi_create_uint32(env, (uint32_t) token->location->end->line, &end_line);
      napi_create_uint32(env, (uint32_t) token->location->end->column, &end_col);
      napi_set_named_property(env, end_loc_obj, "line", end_line);
      napi_set_named_property(env, end_loc_obj, "column", end_col);
      napi_set_named_property(env, token_obj, "end", end_loc_obj);

      napi_set_element(env, tokens_array, i, token_obj);
    }
  }

  napi_set_named_property(env, result, "tokens", tokens_array);
  napi_set_named_property(env, result, "errors", errors_array);
  napi_set_named_property(env, result, "warnings", warnings_array);

  return result;
}

napi_value CreateParseResult(napi_env env, AST_DOCUMENT_NODE_T* root, napi_value source) {
  napi_value result;
  napi_create_object(env, &result);

  // TODO
  napi_set_named_property(env, result, "source", source);

  return result;
}

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
  snprintf(version_buf, sizeof(version_buf), "libherb@%s (native)", native_version);

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
    { "extractHtml", nullptr, Herb_extract_html, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "version", nullptr, Herb_version, nullptr, nullptr, nullptr, napi_default, nullptr },
  };

  napi_define_properties(env, exports, sizeof(descriptors) / sizeof(descriptors[0]), descriptors);

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
