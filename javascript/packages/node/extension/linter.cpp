#ifdef HAS_HERB_LINTER

extern "C" {
#include "herb_linter.h"
}

#include "extension_helpers.h"
#include "linter.h"

#include <node_api.h>
#include <stdlib.h>
#include <string.h>

napi_value Herb_lint(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value args[3];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    napi_throw_error(env, nullptr, "Wrong number of arguments");
    return nullptr;
  }

  char* source = CheckString(env, args[0]);
  if (!source) { return nullptr; }

  char* config_json = nullptr;
  if (argc >= 2) {
    napi_valuetype valuetype;
    napi_typeof(env, args[1], &valuetype);
    if (valuetype == napi_string) {
      config_json = CheckString(env, args[1]);
    }
  }

  char* file_name = nullptr;
  if (argc >= 3) {
    napi_valuetype valuetype;
    napi_typeof(env, args[2], &valuetype);
    if (valuetype == napi_string) {
      file_name = CheckString(env, args[2]);
    }
  }

  herb_lint_result_T* result = herb_lint(source, config_json, file_name);

  free(source);
  if (config_json) { free(config_json); }
  if (file_name) { free(file_name); }

  if (result == nullptr) {
    napi_value null_value;
    napi_get_null(env, &null_value);
    return null_value;
  }

  napi_value json_string;
  napi_create_string_utf8(env, result->json, NAPI_AUTO_LENGTH, &json_string);

  napi_value global;
  napi_get_global(env, &global);

  napi_value json_object;
  napi_get_named_property(env, global, "JSON", &json_object);

  napi_value parse_function;
  napi_get_named_property(env, json_object, "parse", &parse_function);

  napi_value parsed;
  napi_call_function(env, json_object, parse_function, 1, &json_string, &parsed);

  herb_lint_result_free(result);

  return parsed;
}

napi_value Herb_lint_rule_count(napi_env env, napi_callback_info info) {
  size_t count = herb_lint_rule_count();

  napi_value result;
  napi_create_uint32(env, (uint32_t) count, &result);

  return result;
}

napi_value Herb_lint_rule_names(napi_env env, napi_callback_info info) {
  size_t count = 0;
  char** names = herb_lint_rule_names(&count);

  napi_value array;
  napi_create_array_with_length(env, count, &array);

  for (size_t index = 0; index < count; index++) {
    napi_value name;
    napi_create_string_utf8(env, names[index], NAPI_AUTO_LENGTH, &name);
    napi_set_element(env, array, (uint32_t) index, name);
  }

  herb_lint_rule_names_free(names, count);

  return array;
}

#endif
