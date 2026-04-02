#include "../include/analyze/render_nodes.h"
#include "../include/analyze/action_view/tag_helper_node_builders.h"
#include "../include/analyze/action_view/tag_helpers.h"
#include "../include/analyze/analyze.h"
#include "../include/ast/ast_nodes.h"
#include "../include/errors.h"
#include "../include/lib/hb_allocator.h"
#include "../include/lib/hb_array.h"
#include "../include/lib/hb_string.h"
#include "../include/lib/string.h"
#include "../include/visitor.h"

#include <prism.h>
#include <stdbool.h>
#include <string.h>

static token_T* create_token_from_prism_node(
  pm_node_t* node,
  const char* value,
  token_type_T type,
  const char* source,
  size_t erb_content_offset,
  const uint8_t* erb_content_source,
  hb_allocator_T* allocator
);

typedef struct {
  char* value;
  pm_node_t* value_node;
} keyword_result_T;

typedef struct {
  const char* name;
  token_T** target;
} keyword_field_T;

// actionview/lib/action_view/render_parser.rb
static const char* render_keywords[] = {
  "partial", "template",   "layout",   "file",       "inline",       "body",     "plain",
  "html",    "renderable", "locals",   "collection", "object",       "as",       "spacer_template",
  "formats", "variants",   "handlers", "status",     "content_type", "location", NULL
};

static bool is_render_call(pm_call_node_t* call_node, pm_parser_t* parser) {
  if (!call_node || !call_node->name) { return false; }

  pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, call_node->name);

  return constant && constant->length == 6 && strncmp((const char*) constant->start, "render", 6) == 0;
}

static pm_call_node_t* find_render_call(pm_node_t* node, pm_parser_t* parser) {
  if (!node) { return NULL; }

  if (node->type == PM_CALL_NODE) {
    pm_call_node_t* call_node = (pm_call_node_t*) node;
    if (is_render_call(call_node, parser)) { return call_node; }
  }

  if (node->type == PM_PROGRAM_NODE) {
    pm_program_node_t* program = (pm_program_node_t*) node;
    if (program->statements && program->statements->body.size > 0) {
      return find_render_call(program->statements->body.nodes[0], parser);
    }
  }

  if (node->type == PM_STATEMENTS_NODE) {
    pm_statements_node_t* statements = (pm_statements_node_t*) node;
    if (statements->body.size > 0) { return find_render_call(statements->body.nodes[0], parser); }
  }

  return NULL;
}

static pm_block_node_t* find_block_on_render_call(pm_call_node_t* render_call) {
  if (!render_call) { return NULL; }

  if (render_call->block && render_call->block->type == PM_BLOCK_NODE) { return (pm_block_node_t*) render_call->block; }

  pm_arguments_node_t* arguments = render_call->arguments;
  if (!arguments || arguments->arguments.size == 0) { return NULL; }

  pm_node_t* first_argument = arguments->arguments.nodes[0];

  if (first_argument->type == PM_CALL_NODE) {
    pm_call_node_t* argument_call = (pm_call_node_t*) first_argument;

    if (argument_call->block && argument_call->block->type == PM_BLOCK_NODE) {
      return (pm_block_node_t*) argument_call->block;
    }
  }

  return NULL;
}

static hb_array_T* extract_block_arguments(
  pm_block_node_t* block_node,
  pm_parser_t* parser,
  const char* source,
  size_t erb_content_offset,
  const uint8_t* erb_content_source,
  hb_allocator_T* allocator
) {
  if (!block_node || !block_node->parameters) { return hb_array_init(0, allocator); }
  if (block_node->parameters->type != PM_BLOCK_PARAMETERS_NODE) { return hb_array_init(0, allocator); }

  pm_block_parameters_node_t* block_parameters = (pm_block_parameters_node_t*) block_node->parameters;
  pm_parameters_node_t* parameters = block_parameters->parameters;

  if (!parameters) { return hb_array_init(0, allocator); }

  size_t count = parameters->requireds.size + parameters->optionals.size + parameters->keywords.size;
  if (parameters->rest) { count++; }
  if (parameters->keyword_rest) { count++; }
  if (parameters->block) { count++; }

  hb_array_T* result = hb_array_init(count, allocator);

  for (size_t index = 0; index < parameters->requireds.size; index++) {
    pm_node_t* parameter = parameters->requireds.nodes[index];
    if (parameter->type != PM_REQUIRED_PARAMETER_NODE) { continue; }

    pm_required_parameter_node_t* required = (pm_required_parameter_node_t*) parameter;
    pm_constant_t* constant = pm_constant_pool_id_to_constant(&parser->constant_pool, required->name);
    if (!constant) { continue; }

    char* name = hb_allocator_strndup(allocator, (const char*) constant->start, constant->length);

    token_T* name_token = create_token_from_prism_node(
      parameter,
      name,
      TOKEN_IDENTIFIER,
      source,
      erb_content_offset,
      erb_content_source,
      allocator
    );

    position_T start = name_token ? name_token->location.start : (position_T) { .line = 1, .column = 1 };
    position_T end = name_token ? name_token->location.end : (position_T) { .line = 1, .column = 1 };

    AST_RUBY_BLOCK_PARAMETER_NODE_T* parameter_node =
      ast_ruby_block_parameter_node_init(name_token, start, end, hb_array_init(0, allocator), allocator);

    hb_array_append(result, parameter_node);
    hb_allocator_dealloc(allocator, name);
  }

  return result;
}

static char* extract_string_value(pm_node_t* node, hb_allocator_T* allocator) {
  if (!node) { return NULL; }

  if (node->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) node;
    size_t length = pm_string_length(&string_node->unescaped);
    return hb_allocator_strndup(allocator, (const char*) pm_string_source(&string_node->unescaped), length);
  }

  if (node->type == PM_SYMBOL_NODE) {
    pm_symbol_node_t* symbol_node = (pm_symbol_node_t*) node;
    size_t length = pm_string_length(&symbol_node->unescaped);
    return hb_allocator_strndup(allocator, (const char*) pm_string_source(&symbol_node->unescaped), length);
  }

  return NULL;
}

static char* extract_source_expression(pm_node_t* node, hb_allocator_T* allocator) {
  if (!node) { return NULL; }

  size_t length = node->location.end - node->location.start;
  return hb_allocator_strndup(allocator, (const char*) node->location.start, length);
}

static token_T* create_token_from_prism_node(
  pm_node_t* node,
  const char* value,
  token_type_T type,
  const char* source,
  size_t erb_content_offset,
  const uint8_t* erb_content_source,
  hb_allocator_T* allocator
) {
  position_T start = { .line = 1, .column = 1 };
  position_T end = { .line = 1, .column = 1 };

  if (node && source && erb_content_source) {
    size_t start_offset_in_erb = (size_t) (node->location.start - erb_content_source);
    size_t end_offset_in_erb = (size_t) (node->location.end - erb_content_source);

    size_t total_start = erb_content_offset + start_offset_in_erb;
    size_t total_end = erb_content_offset + end_offset_in_erb;

    start = byte_offset_to_position(source, total_start);
    end = byte_offset_to_position(source, total_end);
  }

  return create_synthetic_token(allocator, value, type, start, end);
}

static pm_keyword_hash_node_t* find_keyword_hash(pm_arguments_node_t* arguments) {
  if (!arguments || arguments->arguments.size == 0) { return NULL; }

  pm_node_t* last = arguments->arguments.nodes[arguments->arguments.size - 1];
  if (last->type == PM_KEYWORD_HASH_NODE) { return (pm_keyword_hash_node_t*) last; }

  return NULL;
}

static keyword_result_T find_keyword_value(
  pm_keyword_hash_node_t* keyword_hash,
  const char* key,
  hb_allocator_T* allocator
) {
  keyword_result_T result = { .value = NULL, .value_node = NULL };
  if (!keyword_hash) { return result; }

  for (size_t index = 0; index < keyword_hash->elements.size; index++) {
    pm_node_t* element = keyword_hash->elements.nodes[index];
    if (element->type != PM_ASSOC_NODE) { continue; }

    pm_assoc_node_t* assoc = (pm_assoc_node_t*) element;
    char* assoc_key = extract_string_value(assoc->key, allocator);

    if (assoc_key && string_equals(assoc_key, key)) {
      hb_allocator_dealloc(allocator, assoc_key);

      result.value_node = assoc->value;

      char* string_value = extract_string_value(assoc->value, allocator);

      if (string_value) {
        result.value = string_value;
      } else {
        result.value = extract_source_expression(assoc->value, allocator);
      }

      return result;
    }

    if (assoc_key) { hb_allocator_dealloc(allocator, assoc_key); }
  }

  return result;
}

static pm_hash_node_t* find_locals_hash(pm_keyword_hash_node_t* keyword_hash, hb_allocator_T* allocator) {
  if (!keyword_hash) { return NULL; }

  for (size_t index = 0; index < keyword_hash->elements.size; index++) {
    pm_node_t* element = keyword_hash->elements.nodes[index];
    if (element->type != PM_ASSOC_NODE) { continue; }

    pm_assoc_node_t* assoc = (pm_assoc_node_t*) element;
    char* key = extract_string_value(assoc->key, allocator);

    if (key && string_equals(key, "locals")) {
      hb_allocator_dealloc(allocator, key);
      if (assoc->value->type == PM_HASH_NODE) { return (pm_hash_node_t*) assoc->value; }
      return NULL;
    }

    if (key) { hb_allocator_dealloc(allocator, key); }
  }

  return NULL;
}

static hb_array_T* extract_locals_from_hash(
  pm_hash_node_t* hash,
  const char* source,
  size_t erb_content_offset,
  const uint8_t* erb_content_source,
  hb_allocator_T* allocator
) {
  hb_array_T* locals = hb_array_init(hash->elements.size, allocator);

  for (size_t index = 0; index < hash->elements.size; index++) {
    pm_node_t* element = hash->elements.nodes[index];
    if (element->type != PM_ASSOC_NODE) { continue; }

    pm_assoc_node_t* assoc = (pm_assoc_node_t*) element;
    char* name = extract_string_value(assoc->key, allocator);
    if (!name) { name = extract_source_expression(assoc->key, allocator); }
    if (!name) { continue; }

    char* value = extract_source_expression(assoc->value, allocator);

    if (!value) {
      hb_allocator_dealloc(allocator, name);
      continue;
    }

    token_T* name_token = create_token_from_prism_node(
      assoc->key,
      name,
      TOKEN_IDENTIFIER,
      source,
      erb_content_offset,
      erb_content_source,
      allocator
    );

    position_T value_start = { .line = 1, .column = 1 };
    position_T value_end = value_start;

    if (assoc->value && source && erb_content_source) {
      size_t start_offset = (size_t) (assoc->value->location.start - erb_content_source);
      size_t end_offset = (size_t) (assoc->value->location.end - erb_content_source);
      value_start = byte_offset_to_position(source, erb_content_offset + start_offset);
      value_end = byte_offset_to_position(source, erb_content_offset + end_offset);
    }

    AST_RUBY_LITERAL_NODE_T* value_node = ast_ruby_literal_node_init(
      hb_string_from_c_string(value),
      value_start,
      value_end,
      hb_array_init(0, allocator),
      allocator
    );

    position_T start = name_token ? name_token->location.start : (position_T) { .line = 1, .column = 1 };
    position_T end = value_end;

    AST_RUBY_RENDER_LOCAL_NODE_T* local_node =
      ast_ruby_render_local_node_init(name_token, value_node, start, end, hb_array_init(0, allocator), allocator);

    hb_array_append(locals, local_node);

    hb_allocator_dealloc(allocator, name);
    hb_allocator_dealloc(allocator, value);
  }

  return locals;
}

static token_T* extract_keyword_token(
  pm_keyword_hash_node_t* keyword_hash,
  const char* keyword_name,
  const char* source,
  size_t erb_content_offset,
  const uint8_t* erb_content_source,
  hb_allocator_T* allocator
) {
  keyword_result_T keyword = find_keyword_value(keyword_hash, keyword_name, allocator);
  if (!keyword.value) { return NULL; }

  token_T* token = create_token_from_prism_node(
    keyword.value_node,
    keyword.value,
    TOKEN_IDENTIFIER,
    source,
    erb_content_offset,
    erb_content_source,
    allocator
  );

  hb_allocator_dealloc(allocator, keyword.value);
  return token;
}

typedef struct {
  hb_array_T* block_body;
  hb_array_T* block_arguments;
  AST_ERB_RESCUE_NODE_T* rescue_clause;
  AST_ERB_ELSE_NODE_T* else_clause;
  AST_ERB_ENSURE_NODE_T* ensure_clause;
  AST_ERB_END_NODE_T* end_node;
} render_block_fields_T;

static AST_ERB_RENDER_NODE_T* create_render_node_from_call(
  AST_ERB_CONTENT_NODE_T* erb_node,
  pm_call_node_t* call_node,
  pm_parser_t* parser,
  const char* source,
  size_t erb_content_offset,
  const uint8_t* erb_content_source,
  render_block_fields_T* block_fields,
  hb_allocator_T* allocator
) {

  pm_arguments_node_t* arguments = call_node->arguments;
  pm_keyword_hash_node_t* keyword_hash = arguments ? find_keyword_hash(arguments) : NULL;

  token_T* partial = NULL;
  token_T* template_path = NULL;
  token_T* layout = NULL;
  token_T* file = NULL;
  token_T* inline_template = NULL;
  token_T* body = NULL;
  token_T* plain = NULL;
  token_T* html = NULL;
  token_T* renderable = NULL;
  token_T* collection = NULL;
  token_T* object = NULL;
  token_T* as_name = NULL;
  token_T* spacer_template = NULL;
  token_T* formats = NULL;
  token_T* variants = NULL;
  token_T* handlers = NULL;
  token_T* content_type = NULL;

  hb_array_T* locals = NULL;
  bool has_keyword_partial = false;
  bool has_positional_partial = false;

  if (arguments && arguments->arguments.size >= 1) {
    pm_node_t* first_argument = arguments->arguments.nodes[0];

    if (first_argument->type == PM_STRING_NODE) {
      char* partial_string = extract_string_value(first_argument, allocator);

      if (partial_string) {
        has_positional_partial = true;

        partial = create_token_from_prism_node(
          first_argument,
          partial_string,
          TOKEN_IDENTIFIER,
          source,
          erb_content_offset,
          erb_content_source,
          allocator
        );

        hb_allocator_dealloc(allocator, partial_string);
      }
    } else if (first_argument->type != PM_KEYWORD_HASH_NODE) {
      char* object_string = extract_source_expression(first_argument, allocator);

      if (object_string) {
        object = create_token_from_prism_node(
          first_argument,
          object_string,
          TOKEN_IDENTIFIER,
          source,
          erb_content_offset,
          erb_content_source,
          allocator
        );
        hb_allocator_dealloc(allocator, object_string);
      }
    }
  }

  if (keyword_hash) {
    if (has_positional_partial) {
      keyword_result_T partial_kw = find_keyword_value(keyword_hash, "partial", allocator);
      if (partial_kw.value) { has_keyword_partial = true; }

      pm_hash_node_t* locals_hash = find_locals_hash(keyword_hash, allocator);

      if (locals_hash) {
        locals = extract_locals_from_hash(locals_hash, source, erb_content_offset, erb_content_source, allocator);
      } else {
        locals = hb_array_init(keyword_hash->elements.size, allocator);

        for (size_t index = 0; index < keyword_hash->elements.size; index++) {
          pm_node_t* element = keyword_hash->elements.nodes[index];
          if (element->type != PM_ASSOC_NODE) { continue; }

          pm_assoc_node_t* assoc = (pm_assoc_node_t*) element;
          char* name = extract_string_value(assoc->key, allocator);
          if (!name) { name = extract_source_expression(assoc->key, allocator); }
          if (!name) { continue; }

          char* value = extract_source_expression(assoc->value, allocator);

          if (!value) {
            hb_allocator_dealloc(allocator, name);
            continue;
          }

          token_T* name_token = create_token_from_prism_node(
            assoc->key,
            name,
            TOKEN_IDENTIFIER,
            source,
            erb_content_offset,
            erb_content_source,
            allocator
          );

          position_T value_start = { .line = 1, .column = 1 };
          position_T value_end = value_start;

          if (assoc->value && source && erb_content_source) {
            size_t start_offset = (size_t) (assoc->value->location.start - erb_content_source);
            size_t end_offset = (size_t) (assoc->value->location.end - erb_content_source);
            value_start = byte_offset_to_position(source, erb_content_offset + start_offset);
            value_end = byte_offset_to_position(source, erb_content_offset + end_offset);
          }

          AST_RUBY_LITERAL_NODE_T* value_node = ast_ruby_literal_node_init(
            hb_string_from_c_string(value),
            value_start,
            value_end,
            hb_array_init(0, allocator),
            allocator
          );

          position_T start = name_token ? name_token->location.start : (position_T) { .line = 1, .column = 1 };

          AST_RUBY_RENDER_LOCAL_NODE_T* local_node = ast_ruby_render_local_node_init(
            name_token,
            value_node,
            start,
            value_end,
            hb_array_init(0, allocator),
            allocator
          );

          hb_array_append(locals, local_node);
          hb_allocator_dealloc(allocator, name);
          hb_allocator_dealloc(allocator, value);
        }
      }
    } else {
      keyword_field_T keyword_fields[] = {
        { "partial", &partial },
        { "template", &template_path },
        { "layout", &layout },
        { "file", &file },
        { "inline", &inline_template },
        { "body", &body },
        { "plain", &plain },
        { "html", &html },
        { "renderable", &renderable },
        { "collection", &collection },
        { "object", &object },
        { "as", &as_name },
        { "spacer_template", &spacer_template },
        { "formats", &formats },
        { "variants", &variants },
        { "handlers", &handlers },
        { "content_type", &content_type },
      };

      for (size_t index = 0; index < sizeof(keyword_fields) / sizeof(keyword_fields[0]); index++) {
        *keyword_fields[index].target = extract_keyword_token(
          keyword_hash,
          keyword_fields[index].name,
          source,
          erb_content_offset,
          erb_content_source,
          allocator
        );
      }

      if (partial) { has_keyword_partial = true; }

      pm_hash_node_t* locals_hash = find_locals_hash(keyword_hash, allocator);

      if (locals_hash) {
        locals = extract_locals_from_hash(locals_hash, source, erb_content_offset, erb_content_source, allocator);
      }
    }
  }

  if (!locals) { locals = hb_array_init(0, allocator); }

  hb_array_T* errors = hb_array_init(0, allocator);

  if (!has_keyword_partial && partial && keyword_hash) {
    keyword_result_T locals_keyword = find_keyword_value(keyword_hash, "locals", allocator);

    if (locals_keyword.value) {
      hb_string_T partial_name = partial->value;

      append_render_ambiguous_locals_error(
        partial_name,
        erb_node->base.location.start,
        erb_node->base.location.end,
        allocator,
        errors
      );

      hb_allocator_dealloc(allocator, locals_keyword.value);
    }
  }

  if (has_keyword_partial && partial && keyword_hash && hb_array_size(locals) == 0) {
    bool has_non_render_kwargs = false;
    size_t keywords_length = 0;

    for (size_t index = 0; index < keyword_hash->elements.size; index++) {
      pm_node_t* element = keyword_hash->elements.nodes[index];
      if (element->type != PM_ASSOC_NODE) { continue; }

      pm_assoc_node_t* assoc = (pm_assoc_node_t*) element;
      char* key = extract_string_value(assoc->key, allocator);
      if (!key) { continue; }

      bool is_known = false;

      for (size_t keyword_index = 0; render_keywords[keyword_index] != NULL; keyword_index++) {
        if (string_equals(key, render_keywords[keyword_index])) {
          is_known = true;
          break;
        }
      }

      if (!is_known) {
        has_non_render_kwargs = true;
        keywords_length += strlen(key) + 2;
      }

      hb_allocator_dealloc(allocator, key);
    }

    if (has_non_render_kwargs) {
      char* keywords_buffer = hb_allocator_alloc(allocator, keywords_length + 1);
      keywords_buffer[0] = '\0';
      bool first = true;

      for (size_t index = 0; index < keyword_hash->elements.size; index++) {
        pm_node_t* element = keyword_hash->elements.nodes[index];
        if (element->type != PM_ASSOC_NODE) { continue; }

        pm_assoc_node_t* assoc = (pm_assoc_node_t*) element;
        char* key = extract_string_value(assoc->key, allocator);
        if (!key) { continue; }

        bool is_known = false;

        for (size_t keyword_index = 0; render_keywords[keyword_index] != NULL; keyword_index++) {
          if (string_equals(key, render_keywords[keyword_index])) {
            is_known = true;
            break;
          }
        }

        if (!is_known) {
          if (!first) { strcat(keywords_buffer, ", "); }
          strcat(keywords_buffer, key);
          first = false;
        }

        hb_allocator_dealloc(allocator, key);
      }

      append_render_missing_locals_error(
        partial->value,
        hb_string_from_c_string(keywords_buffer),
        erb_node->base.location.start,
        erb_node->base.location.end,
        allocator,
        errors
      );

      hb_allocator_dealloc(allocator, keywords_buffer);
    }
  }

  if (!partial && !template_path && !layout && !file && !inline_template && !body && !plain && !html && !renderable
      && !has_positional_partial && !object) {
    append_render_no_arguments_error(erb_node->base.location.start, erb_node->base.location.end, allocator, errors);
  }

  if (has_positional_partial && has_keyword_partial && keyword_hash) {
    keyword_result_T keyword_partial = find_keyword_value(keyword_hash, "partial", allocator);

    append_render_conflicting_partial_error(
      partial->value,
      keyword_partial.value ? hb_string_from_c_string(keyword_partial.value) : hb_string(""),
      erb_node->base.location.start,
      erb_node->base.location.end,
      allocator,
      errors
    );

    if (keyword_partial.value) { hb_allocator_dealloc(allocator, keyword_partial.value); }
  }

  if (as_name) {
    const char* as_value = as_name->value.data;
    uint32_t as_length = as_name->value.length;
    bool as_valid = as_length > 0;

    if (as_valid) {
      char first_char = as_value[0];
      as_valid = (first_char >= 'a' && first_char <= 'z') || first_char == '_';
    }

    for (uint32_t char_index = 1; as_valid && char_index < as_length; char_index++) {
      char character = as_value[char_index];
      as_valid = (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z')
              || (character >= '0' && character <= '9') || character == '_';
    }

    if (!as_valid) {
      append_render_invalid_as_option_error(
        as_name->value,
        erb_node->base.location.start,
        erb_node->base.location.end,
        allocator,
        errors
      );
    }
  }

  if (object && collection) {
    append_render_object_and_collection_error(
      erb_node->base.location.start,
      erb_node->base.location.end,
      allocator,
      errors
    );
  }

  if (layout && !partial && !template_path) {
    append_render_layout_without_block_error(
      layout->value,
      erb_node->base.location.start,
      erb_node->base.location.end,
      allocator,
      errors
    );
  }

  herb_prism_node_T prism_node = erb_node->prism_node;

  hb_array_T* render_block_body = block_fields ? block_fields->block_body : NULL;
  hb_array_T* render_block_arguments = block_fields ? block_fields->block_arguments : NULL;

  AST_ERB_RESCUE_NODE_T* render_rescue_clause = block_fields ? block_fields->rescue_clause : NULL;
  AST_ERB_ELSE_NODE_T* render_else_clause = block_fields ? block_fields->else_clause : NULL;
  AST_ERB_ENSURE_NODE_T* render_ensure_clause = block_fields ? block_fields->ensure_clause : NULL;
  AST_ERB_END_NODE_T* render_end_node = block_fields ? block_fields->end_node : NULL;

  if (!render_block_body) { render_block_body = hb_array_init(0, allocator); }
  if (!render_block_arguments) { render_block_arguments = hb_array_init(0, allocator); }

  if (!block_fields) {
    pm_block_node_t* inline_block = find_block_on_render_call(call_node);

    if (inline_block) {
      const uint8_t* content_source = erb_content_source ? erb_content_source : (const uint8_t*) parser->start;

      render_block_arguments =
        extract_block_arguments(inline_block, parser, source, erb_content_offset, content_source, allocator);

      if (inline_block->body) {
        size_t body_length = (size_t) (inline_block->body->location.end - inline_block->body->location.start);
        char* body_source =
          hb_allocator_strndup(allocator, (const char*) inline_block->body->location.start, body_length);

        position_T body_start = { .line = 1, .column = 1 };
        position_T body_end = { .line = 1, .column = 1 };

        if (source && content_source) {
          size_t start_offset = (size_t) (inline_block->body->location.start - content_source);
          size_t end_offset = (size_t) (inline_block->body->location.end - content_source);
          body_start = byte_offset_to_position(source, erb_content_offset + start_offset);
          body_end = byte_offset_to_position(source, erb_content_offset + end_offset);
        }

        AST_RUBY_LITERAL_NODE_T* body_node = ast_ruby_literal_node_init(
          hb_string_from_c_string(body_source),
          body_start,
          body_end,
          hb_array_init(0, allocator),
          allocator
        );

        render_block_body = hb_array_init(1, allocator);
        hb_array_append(render_block_body, body_node);

        hb_allocator_dealloc(allocator, body_source);
      }
    }
  }

  AST_RUBY_RENDER_KEYWORDS_NODE_T* keywords_node = ast_ruby_render_keywords_node_init(
    partial,
    template_path,
    layout,
    file,
    inline_template,
    body,
    plain,
    html,
    renderable,
    collection,
    object,
    as_name,
    spacer_template,
    formats,
    variants,
    handlers,
    content_type,
    locals,
    erb_node->base.location.start,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  AST_ERB_RENDER_NODE_T* render_node = ast_erb_render_node_init(
    erb_node->tag_opening,
    erb_node->content,
    erb_node->tag_closing,
    erb_node->analyzed_ruby,
    prism_node,
    keywords_node,
    render_block_body,
    render_block_arguments,
    render_rescue_clause,
    render_else_clause,
    render_ensure_clause,
    render_end_node,
    erb_node->base.location.start,
    erb_node->base.location.end,
    errors,
    allocator
  );

  return render_node;
}

static size_t calculate_byte_offset_from_pos(const char* source, position_T position) {
  if (!source) { return 0; }

  size_t offset = 0;
  uint32_t line = 1;
  uint32_t column = 1;

  while (source[offset] != '\0') {
    if (line == position.line && column == position.column) { return offset; }

    if (source[offset] == '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }

    offset++;
  }

  return offset;
}

static bool is_erb_comment_tag(token_T* tag_opening) {
  if (!tag_opening || hb_string_is_empty(tag_opening->value)) { return false; }

  const char* opening_string = tag_opening->value.data;
  return opening_string && strstr(opening_string, "#") != NULL;
}

static AST_ERB_RENDER_NODE_T* try_transform_content_node(
  AST_ERB_CONTENT_NODE_T* erb_node,
  analyze_ruby_context_T* context
) {
  if (!erb_node->analyzed_ruby || !erb_node->analyzed_ruby->valid || !erb_node->analyzed_ruby->parsed) { return NULL; }
  if (is_erb_comment_tag(erb_node->tag_opening)) { return NULL; }

  pm_call_node_t* render_call = find_render_call(erb_node->analyzed_ruby->root, &erb_node->analyzed_ruby->parser);
  if (!render_call) { return NULL; }

  size_t erb_content_offset = 0;

  if (context->source && erb_node->content) {
    erb_content_offset = calculate_byte_offset_from_pos(context->source, erb_node->content->location.start);
  }

  const uint8_t* erb_content_source = (const uint8_t*) erb_node->analyzed_ruby->parser.start;

  return create_render_node_from_call(
    erb_node,
    render_call,
    &erb_node->analyzed_ruby->parser,
    context->source,
    erb_content_offset,
    erb_content_source,
    NULL,
    context->allocator
  );
}

static AST_ERB_RENDER_NODE_T* try_transform_block_node(
  AST_ERB_BLOCK_NODE_T* block_node,
  analyze_ruby_context_T* context
) {
  AST_ERB_CONTENT_NODE_T content_view = {
    .base = block_node->base,
    .tag_opening = block_node->tag_opening,
    .content = block_node->content,
    .tag_closing = block_node->tag_closing,
    .analyzed_ruby = NULL,
    .parsed = true,
    .valid = true,
    .prism_node = block_node->prism_node,
  };

  if (!block_node->content || hb_string_is_empty(block_node->content->value)) { return NULL; }

  const char* ruby_source = block_node->content->value.data;
  size_t ruby_length = block_node->content->value.length;

  pm_parser_t parser;
  pm_parser_init(&parser, (const uint8_t*) ruby_source, ruby_length, NULL);
  pm_node_t* root = pm_parse(&parser);

  pm_call_node_t* render_call = find_render_call(root, &parser);

  if (!render_call) {
    pm_node_destroy(&parser, root);
    pm_parser_free(&parser);
    return NULL;
  }

  size_t erb_content_offset = 0;

  if (context->source && block_node->content) {
    erb_content_offset = calculate_byte_offset_from_pos(context->source, block_node->content->location.start);
  }

  const uint8_t* erb_content_source = (const uint8_t*) parser.start;

  pm_block_node_t* prism_block = find_block_on_render_call(render_call);
  hb_array_T* block_arguments = extract_block_arguments(
    prism_block,
    &parser,
    context->source,
    erb_content_offset,
    erb_content_source,
    context->allocator
  );

  render_block_fields_T block_fields = {
    .block_body = block_node->body,
    .block_arguments = block_arguments,
    .rescue_clause = block_node->rescue_clause,
    .else_clause = block_node->else_clause,
    .ensure_clause = block_node->ensure_clause,
    .end_node = block_node->end_node,
  };

  AST_ERB_RENDER_NODE_T* render_node = create_render_node_from_call(
    &content_view,
    render_call,
    &parser,
    context->source,
    erb_content_offset,
    erb_content_source,
    &block_fields,
    context->allocator
  );

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);

  return render_node;
}

static void transform_render_nodes_in_array(hb_array_T* array, analyze_ruby_context_T* context) {
  if (!array) { return; }

  for (size_t index = 0; index < hb_array_size(array); index++) {
    AST_NODE_T* child = hb_array_get(array, index);
    if (!child) { continue; }

    AST_ERB_RENDER_NODE_T* render_node = NULL;

    if (child->type == AST_ERB_CONTENT_NODE) {
      render_node = try_transform_content_node((AST_ERB_CONTENT_NODE_T*) child, context);
    } else if (child->type == AST_ERB_BLOCK_NODE) {
      render_node = try_transform_block_node((AST_ERB_BLOCK_NODE_T*) child, context);
    }

    if (render_node) { hb_array_set(array, index, render_node); }
  }
}

static void transform_render_in_node(const AST_NODE_T* node, analyze_ruby_context_T* context) {
  if (!node || !context) { return; }

  transform_render_nodes_in_array(get_node_children_array(node), context);
}

bool transform_render_nodes(const AST_NODE_T* node, void* data) {
  analyze_ruby_context_T* context = (analyze_ruby_context_T*) data;

  transform_render_in_node(node, context);

  herb_visit_child_nodes(node, transform_render_nodes, data);

  return false;
}
