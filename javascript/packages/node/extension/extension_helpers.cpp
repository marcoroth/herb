#include <node_api.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

extern "C" {
#include "../../../../src/include/array.h"
#include "../../../../src/include/ast_nodes.h"
#include "../../../../src/include/buffer.h"
#include "../../../../src/include/herb.h"
#include "../../../../src/include/io.h"
#include "../../../../src/include/location.h"
#include "../../../../src/include/position.h"
#include "../../../../src/include/range.h"
#include "../../../../src/include/token.h"
}

#include "error_helpers.h"
#include "nodes.h"

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

napi_value CreateString(napi_env env, const char* str) {
  napi_value result;
  napi_create_string_utf8(env, str, NAPI_AUTO_LENGTH, &result);
  return result;
}

napi_value CreatePosition(napi_env env, position_T* position) {
  if (!position) {
    napi_value null_value;
    napi_get_null(env, &null_value);
    return null_value;
  }

  napi_value result;
  napi_create_object(env, &result);

  napi_value line, column;
  napi_create_uint32(env, (uint32_t)position->line, &line);
  napi_create_uint32(env, (uint32_t)position->column, &column);

  napi_set_named_property(env, result, "line", line);
  napi_set_named_property(env, result, "column", column);

  return result;
}

napi_value CreateLocation(napi_env env, location_T* location) {
  if (!location) {
    napi_value null_value;
    napi_get_null(env, &null_value);
    return null_value;
  }

  napi_value result;
  napi_create_object(env, &result);

  napi_value start = CreatePosition(env, location->start);
  napi_value end = CreatePosition(env, location->end);

  napi_set_named_property(env, result, "start", start);
  napi_set_named_property(env, result, "end", end);

  return result;
}

napi_value CreateRange(napi_env env, range_T* range) {
  if (!range) {
    napi_value null_value;
    napi_get_null(env, &null_value);
    return null_value;
  }

  napi_value result;
  napi_create_array(env, &result);

  napi_value from, to;
  napi_create_uint32(env, (uint32_t)range->from, &from);
  napi_create_uint32(env, (uint32_t)range->to, &to);

  napi_set_element(env, result, 0, from);
  napi_set_element(env, result, 1, to);

  return result;
}

napi_value CreateToken(napi_env env, token_T* token) {
  if (!token) {
    napi_value null_value;
    napi_get_null(env, &null_value);
    return null_value;
  }

  napi_value result;
  napi_create_object(env, &result);

  // Value
  napi_value value = token->value ? CreateString(env, token->value) : nullptr;
  if (value) {
    napi_set_named_property(env, result, "value", value);
  } else {
    napi_value null_value;
    napi_get_null(env, &null_value);
    napi_set_named_property(env, result, "value", null_value);
  }

  // Range
  napi_value range = CreateRange(env, token->range);
  napi_set_named_property(env, result, "range", range);

  // Location
  napi_value location = CreateLocation(env, token->location);
  napi_set_named_property(env, result, "location", location);

  // Type
  napi_value type = CreateString(env, token_type_to_string(token->type));
  napi_set_named_property(env, result, "type", type);

  return result;
}

napi_value ReadFileToString(napi_env env, const char* file_path) {
  char* content = herb_read_file(file_path);
  if (!content) {
    napi_throw_error(env, nullptr, "Failed to read file");
    return nullptr;
  }

  napi_value result = CreateString(env, content);
  free(content);
  return result;
}

napi_value CreateLexResult(napi_env env, array_T* tokens, napi_value source) {
  napi_value result, tokens_array, errors_array, warnings_array;

  napi_create_object(env, &result);
  napi_create_array(env, &tokens_array);
  napi_create_array(env, &errors_array);
  napi_create_array(env, &warnings_array);

  // Add tokens to array
  if (tokens) {
    for (size_t i = 0; i < array_size(tokens); i++) {
      token_T* token = (token_T*)array_get(tokens, i);
      if (token) {
        napi_value token_obj = CreateToken(env, token);
        napi_set_element(env, tokens_array, i, token_obj);
      }
    }
  }

  napi_set_named_property(env, result, "tokens", tokens_array);
  napi_set_named_property(env, result, "source", source);
  napi_set_named_property(env, result, "warnings", warnings_array);
  napi_set_named_property(env, result, "errors", errors_array);

  // Free tokens after creating JS objects
  herb_free_tokens(&tokens);

  return result;
}

napi_value CreateParseResult(napi_env env, AST_DOCUMENT_NODE_T* root, napi_value source) {
  napi_value result, errors_array, warnings_array;

  napi_create_object(env, &result);
  napi_create_array(env, &errors_array);
  napi_create_array(env, &warnings_array);

  // Convert the AST to a JavaScript object
  napi_value ast_value;
  if (root) {
    ast_value = NodeFromCStruct(env, (AST_NODE_T*)root);
  } else {
    napi_get_null(env, &ast_value);
  }

  napi_set_named_property(env, result, "value", ast_value);
  napi_set_named_property(env, result, "source", source);
  napi_set_named_property(env, result, "warnings", warnings_array);
  napi_set_named_property(env, result, "errors", errors_array);

  return result;
}
