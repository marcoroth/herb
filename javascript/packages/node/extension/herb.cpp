extern "C" {
#include "../extension/libherb/include/ast/ast_nodes.h"
#include "../extension/libherb/include/extract.h"
#include "../extension/libherb/include/herb.h"
#include "../extension/libherb/include/diff/herb_diff.h"
#include "../extension/libherb/include/location/location.h"
#include "../extension/libherb/include/location/range.h"
#include "../extension/libherb/include/lexer/token.h"
#include "../extension/libherb/include/lib/hb_allocator.h"
#include "../extension/libherb/include/lib/hb_array.h"
#include "../extension/libherb/include/lib/hb_buffer.h"
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

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) {
    free(string);
    napi_throw_error(env, nullptr, "Failed to initialize allocator");
    return nullptr;
  }

  hb_array_T* tokens = herb_lex(string, &allocator);
  napi_value result = CreateLexResult(env, tokens, args[0]);

  herb_free_tokens(&tokens, &allocator);
  hb_allocator_destroy(&allocator);
  free(string);

  return result;
}

napi_value Herb_parse(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    napi_throw_error(env, nullptr, "Wrong number of arguments");
    return nullptr;
  }

  char* string = CheckString(env, args[0]);
  if (!string) { return nullptr; }

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;

  if (argc >= 2) {
    napi_valuetype valuetype;
    napi_typeof(env, args[1], &valuetype);

    if (valuetype == napi_object) {
      napi_value track_whitespace_prop;
      bool has_track_whitespace_prop;
      napi_has_named_property(env, args[1], "track_whitespace", &has_track_whitespace_prop);

      if (has_track_whitespace_prop) {
        napi_get_named_property(env, args[1], "track_whitespace", &track_whitespace_prop);
        bool track_whitespace_value;
        napi_get_value_bool(env, track_whitespace_prop, &track_whitespace_value);

        if (track_whitespace_value) {
          parser_options.track_whitespace = true;
        }
      }

      napi_value analyze_prop;
      bool has_analyze_prop;
      napi_has_named_property(env, args[1], "analyze", &has_analyze_prop);

      if (has_analyze_prop) {
        napi_get_named_property(env, args[1], "analyze", &analyze_prop);
        bool analyze_value;
        napi_get_value_bool(env, analyze_prop, &analyze_value);

        if (!analyze_value) {
          parser_options.analyze = false;
        }
      }

      napi_value strict_prop;
      bool has_strict_prop;
      napi_has_named_property(env, args[1], "strict", &has_strict_prop);

      if (has_strict_prop) {
        napi_get_named_property(env, args[1], "strict", &strict_prop);
        bool strict_value;
        napi_get_value_bool(env, strict_prop, &strict_value);
        parser_options.strict = strict_value;
      }

      napi_value action_view_helpers_prop;
      bool has_action_view_helpers_prop;
      napi_has_named_property(env, args[1], "action_view_helpers", &has_action_view_helpers_prop);

      if (has_action_view_helpers_prop) {
        napi_get_named_property(env, args[1], "action_view_helpers", &action_view_helpers_prop);
        bool action_view_helpers_value;
        napi_get_value_bool(env, action_view_helpers_prop, &action_view_helpers_value);
        parser_options.action_view_helpers = action_view_helpers_value;
      }

      napi_value render_nodes_prop;
      bool has_render_nodes_prop;
      napi_has_named_property(env, args[1], "render_nodes", &has_render_nodes_prop);

      if (has_render_nodes_prop) {
        napi_get_named_property(env, args[1], "render_nodes", &render_nodes_prop);
        bool render_nodes_value;
        napi_get_value_bool(env, render_nodes_prop, &render_nodes_value);
        parser_options.render_nodes = render_nodes_value;
      }

      napi_value strict_locals_prop;
      bool has_strict_locals_prop;
      napi_has_named_property(env, args[1], "strict_locals", &has_strict_locals_prop);

      if (has_strict_locals_prop) {
        napi_get_named_property(env, args[1], "strict_locals", &strict_locals_prop);
        bool strict_locals_value;
        napi_get_value_bool(env, strict_locals_prop, &strict_locals_value);
        parser_options.strict_locals = strict_locals_value;
      }

      napi_value prism_nodes_prop;
      bool has_prism_nodes_prop;
      napi_has_named_property(env, args[1], "prism_nodes", &has_prism_nodes_prop);

      if (has_prism_nodes_prop) {
        napi_get_named_property(env, args[1], "prism_nodes", &prism_nodes_prop);
        bool prism_nodes_value;
        napi_get_value_bool(env, prism_nodes_prop, &prism_nodes_value);
        parser_options.prism_nodes = prism_nodes_value;
      }

      napi_value prism_nodes_deep_prop;
      bool has_prism_nodes_deep_prop;
      napi_has_named_property(env, args[1], "prism_nodes_deep", &has_prism_nodes_deep_prop);

      if (has_prism_nodes_deep_prop) {
        napi_get_named_property(env, args[1], "prism_nodes_deep", &prism_nodes_deep_prop);
        bool prism_nodes_deep_value;
        napi_get_value_bool(env, prism_nodes_deep_prop, &prism_nodes_deep_value);
        parser_options.prism_nodes_deep = prism_nodes_deep_value;
      }

      napi_value prism_program_prop;
      bool has_prism_program_prop;
      napi_has_named_property(env, args[1], "prism_program", &has_prism_program_prop);

      if (has_prism_program_prop) {
        napi_get_named_property(env, args[1], "prism_program", &prism_program_prop);
        bool prism_program_value;
        napi_get_value_bool(env, prism_program_prop, &prism_program_value);
        parser_options.prism_program = prism_program_value;
      }
    }
  }

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) {
    free(string);
    napi_throw_error(env, nullptr, "Failed to initialize allocator");
    return nullptr;
  }

  AST_DOCUMENT_NODE_T* root = herb_parse(string, &parser_options, &allocator);
  napi_value result = CreateParseResult(env, root, args[0], &parser_options);

  ast_node_free((AST_NODE_T *) root, &allocator);
  hb_allocator_destroy(&allocator);
  free(string);

  return result;
}

napi_value Herb_extract_ruby(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    napi_throw_error(env, nullptr, "Wrong number of arguments");
    return nullptr;
  }

  char* string = CheckString(env, args[0]);
  if (!string) { return nullptr; }

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) {
    free(string);
    napi_throw_error(env, nullptr, "Failed to initialize allocator");
    return nullptr;
  }

  hb_buffer_T output;
  if (!hb_buffer_init(&output, strlen(string), &allocator)) {
    hb_allocator_destroy(&allocator);
    free(string);
    napi_throw_error(env, nullptr, "Failed to initialize buffer");
    return nullptr;
  }

  herb_extract_ruby_options_T extract_options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;

  if (argc >= 2) {
    napi_valuetype valuetype;
    napi_typeof(env, args[1], &valuetype);

    if (valuetype == napi_object) {
      napi_value prop;
      bool has_prop;

      napi_has_named_property(env, args[1], "semicolons", &has_prop);
      if (has_prop) {
        napi_get_named_property(env, args[1], "semicolons", &prop);
        bool value;
        napi_get_value_bool(env, prop, &value);
        extract_options.semicolons = value;
      }

      napi_has_named_property(env, args[1], "comments", &has_prop);
      if (has_prop) {
        napi_get_named_property(env, args[1], "comments", &prop);
        bool value;
        napi_get_value_bool(env, prop, &value);
        extract_options.comments = value;
      }

      napi_has_named_property(env, args[1], "preserve_positions", &has_prop);
      if (has_prop) {
        napi_get_named_property(env, args[1], "preserve_positions", &prop);
        bool value;
        napi_get_value_bool(env, prop, &value);
        extract_options.preserve_positions = value;
      }
    }
  }

  herb_extract_ruby_to_buffer_with_options(string, &output, &extract_options, &allocator);

  napi_value result;
  napi_create_string_utf8(env, output.value, NAPI_AUTO_LENGTH, &result);

  hb_buffer_free(&output);
  hb_allocator_destroy(&allocator);
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

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) {
    free(string);
    napi_throw_error(env, nullptr, "Failed to initialize allocator");
    return nullptr;
  }

  hb_buffer_T output;
  if (!hb_buffer_init(&output, strlen(string), &allocator)) {
    hb_allocator_destroy(&allocator);
    free(string);
    napi_throw_error(env, nullptr, "Failed to initialize buffer");
    return nullptr;
  }

  herb_extract_html_to_buffer(string, &output, &allocator);

  napi_value result;
  napi_create_string_utf8(env, output.value, NAPI_AUTO_LENGTH, &result);

  hb_buffer_free(&output);
  hb_allocator_destroy(&allocator);
  free(string);
  return result;
}

napi_value Herb_parse_ruby(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    napi_throw_error(env, nullptr, "Wrong number of arguments");
    return nullptr;
  }

  char* string = CheckString(env, args[0]);
  if (!string) { return nullptr; }

  herb_ruby_parse_result_T* parse_result = herb_parse_ruby(string, strlen(string));

  if (!parse_result) {
    free(string);
    return nullptr;
  }

  pm_buffer_t buffer = { 0 };
  pm_serialize(&parse_result->parser, parse_result->root, &buffer);

  napi_value result = nullptr;

  if (buffer.length > 0) {
    void* data;
    napi_create_buffer_copy(env, buffer.length, buffer.value, &data, &result);
  }

  pm_buffer_free(&buffer);
  herb_free_ruby_parse_result(parse_result);
  free(string);

  return result;
}

napi_value Herb_version(napi_env env, napi_callback_info info) {
  const char* libherb_version = herb_version();
  const char* libprism_version = herb_prism_version();

  char version_buf[256];
  snprintf(version_buf, sizeof(version_buf), "libprism@%s, libherb@%s (Node.js C++ native extension)", libprism_version, libherb_version);

  napi_value result;
  napi_create_string_utf8(env, version_buf, NAPI_AUTO_LENGTH, &result);

  return result;
}

napi_value Herb_diff(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 2) {
    napi_throw_error(env, nullptr, "Wrong number of arguments: expected 2 (old_source, new_source)");
    return nullptr;
  }

  char* old_string = CheckString(env, args[0]);
  if (!old_string) { return nullptr; }

  char* new_string = CheckString(env, args[1]);
  if (!new_string) { free(old_string); return nullptr; }

  hb_allocator_T old_allocator;
  hb_allocator_T new_allocator;
  hb_allocator_T diff_allocator;

  if (!hb_allocator_init(&old_allocator, HB_ALLOCATOR_ARENA)) { free(old_string); free(new_string); return nullptr; }
  if (!hb_allocator_init(&new_allocator, HB_ALLOCATOR_ARENA)) { free(old_string); free(new_string); hb_allocator_destroy(&old_allocator); return nullptr; }
  if (!hb_allocator_init(&diff_allocator, HB_ALLOCATOR_ARENA)) { free(old_string); free(new_string); hb_allocator_destroy(&old_allocator); hb_allocator_destroy(&new_allocator); return nullptr; }

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;

  AST_DOCUMENT_NODE_T* old_root = herb_parse(old_string, &parser_options, &old_allocator);
  AST_DOCUMENT_NODE_T* new_root = herb_parse(new_string, &parser_options, &new_allocator);

  if (old_root == nullptr || new_root == nullptr) {
    if (old_root != nullptr) { ast_node_free((AST_NODE_T*) old_root, &old_allocator); }
    if (new_root != nullptr) { ast_node_free((AST_NODE_T*) new_root, &new_allocator); }

    hb_allocator_destroy(&diff_allocator);
    hb_allocator_destroy(&old_allocator);
    hb_allocator_destroy(&new_allocator);

    free(old_string);
    free(new_string);

    napi_throw_error(env, nullptr, "Failed to parse source");

    return nullptr;
  }

  herb_diff_result_T* diff_result = herb_diff(old_root, new_root, &diff_allocator);

  napi_value result;
  napi_create_object(env, &result);

  napi_value identical;
  napi_get_boolean(env, diff_result->trees_identical, &identical);
  napi_set_named_property(env, result, "identical", identical);

  size_t operation_count = herb_diff_operation_count(diff_result);

  napi_value operations;
  napi_create_array_with_length(env, operation_count, &operations);

  for (size_t index = 0; index < operation_count; index++) {
    const herb_diff_operation_T* operation = herb_diff_operation_at(diff_result, index);

    napi_value operation_object;
    napi_value type_val;
    napi_value path;

    napi_create_object(env, &operation_object);
    napi_create_string_utf8(env, herb_diff_operation_type_to_string(operation->type), NAPI_AUTO_LENGTH, &type_val);
    napi_set_named_property(env, operation_object, "type", type_val);
    napi_create_array_with_length(env, operation->path.depth, &path);

    for (uint16_t path_index = 0; path_index < operation->path.depth; path_index++) {
      napi_value path_val;
      napi_create_uint32(env, operation->path.indices[path_index], &path_val);
      napi_set_element(env, path, path_index, path_val);
    }

    napi_set_named_property(env, operation_object, "path", path);

    if (operation->old_node != NULL) {
      napi_set_named_property(env, operation_object, "oldNode", NodeFromCStruct(env, (AST_NODE_T*) operation->old_node));
    } else {
      napi_value null_val;
      napi_get_null(env, &null_val);
      napi_set_named_property(env, operation_object, "oldNode", null_val);
    }

    if (operation->new_node != NULL) {
      napi_set_named_property(env, operation_object, "newNode", NodeFromCStruct(env, (AST_NODE_T*) operation->new_node));
    } else {
      napi_value null_val;
      napi_get_null(env, &null_val);
      napi_set_named_property(env, operation_object, "newNode", null_val);
    }

    napi_value old_index_val, new_index_val;
    napi_create_uint32(env, operation->old_index, &old_index_val);
    napi_create_uint32(env, operation->new_index, &new_index_val);
    napi_set_named_property(env, operation_object, "oldIndex", old_index_val);
    napi_set_named_property(env, operation_object, "newIndex", new_index_val);

    napi_set_element(env, operations, (uint32_t) index, operation_object);
  }

  napi_set_named_property(env, result, "operations", operations);

  ast_node_free((AST_NODE_T*) old_root, &old_allocator);
  ast_node_free((AST_NODE_T*) new_root, &new_allocator);

  hb_allocator_destroy(&diff_allocator);
  hb_allocator_destroy(&old_allocator);
  hb_allocator_destroy(&new_allocator);

  free(old_string);
  free(new_string);

  return result;
}

napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor descriptors[] = {
    { "parse", nullptr, Herb_parse, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "lex", nullptr, Herb_lex, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "extractRuby", nullptr, Herb_extract_ruby, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "extractHTML", nullptr, Herb_extract_html, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "diff", nullptr, Herb_diff, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "version", nullptr, Herb_version, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "parseRuby", nullptr, Herb_parse_ruby, nullptr, nullptr, nullptr, napi_default, nullptr },
  };

  napi_define_properties(env, exports, sizeof(descriptors) / sizeof(descriptors[0]), descriptors);

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
