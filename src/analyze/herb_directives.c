#include "../include/analyze/herb_directives.h"
#include "../include/analyze/action_view/tag_helper_node_builders.h"
#include "../include/analyze/action_view/tag_helpers.h"
#include "../include/analyze/analyze.h"
#include "../include/ast/ast_nodes.h"
#include "../include/errors.h"
#include "../include/lexer/token.h"
#include "../include/lib/hb_allocator.h"
#include "../include/lib/hb_array.h"
#include "../include/lib/hb_buffer.h"
#include "../include/lib/hb_string.h"
#include "../include/lib/string.h"
#include "../include/util/util.h"
#include "../include/visitor.h"

#include "../include/prism/prism_helpers.h"

#include <prism.h>
#include <stdbool.h>
#include <string.h>

#define HERB_DIRECTIVE_PREFIX "herb:"
#define HERB_STATE_DIRECTIVE_KEY "state"
#define SYNTHETIC_PREFIX "def _"
#define SYNTHETIC_SUFFIX "; end"

#define CANONICAL_TAG_OPENING "<%#"
#define CANONICAL_TAG_CLOSING "%>"

typedef struct {
  const char* bytes;
  size_t length;
  size_t base_offset;
  const char* source;
} directive_content_T;

typedef struct {
  size_t key_start;
  size_t key_end;
} directive_key_T;

static bool is_key_character(const char character) {
  return (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z')
      || (character >= '0' && character <= '9') || character == '_';
}

static position_T content_position(const directive_content_T* content, const size_t offset) {
  return byte_offset_to_position(content->source, content->base_offset + offset);
}

static size_t skip_whitespace(const directive_content_T* content, size_t offset) {
  while (offset < content->length && is_whitespace(content->bytes[offset])) {
    offset++;
  }

  return offset;
}

static size_t trim_trailing_whitespace(const directive_content_T* content, const size_t start, size_t end) {
  while (end > start && is_whitespace(content->bytes[end - 1])) {
    end--;
  }

  return end;
}

static hb_string_T content_slice(const directive_content_T* content, const size_t start, const size_t end) {
  return hb_string_from_data((char*) content->bytes + start, end - start);
}

static token_T* content_token(
  const directive_content_T* content,
  const size_t start,
  const size_t end,
  const token_type_T type,
  hb_allocator_T* allocator
) {
  char* value = hb_allocator_strndup(allocator, content->bytes + start, end - start);
  if (!value) { return NULL; }

  token_T* token =
    create_synthetic_token(allocator, value, type, content_position(content, start), content_position(content, end));

  hb_allocator_dealloc(allocator, value);

  return token;
}

static bool find_directive_key(const directive_content_T* content, directive_key_T* key) {
  size_t offset = skip_whitespace(content, 0);
  size_t prefix_length = strlen(HERB_DIRECTIVE_PREFIX);

  if (offset < content->length && content->bytes[offset] == '-') { offset = skip_whitespace(content, offset + 1); }

  if (content->length - offset < prefix_length) { return false; }
  if (strncmp(content->bytes + offset, HERB_DIRECTIVE_PREFIX, prefix_length) != 0) { return false; }

  size_t start = offset + prefix_length;
  size_t end = start;

  while (end < content->length && is_key_character(content->bytes[end])) {
    end++;
  }

  if (end == start) { return false; }

  key->key_start = start;
  key->key_end = end;

  return true;
}

static bool key_equals(const directive_content_T* content, const directive_key_T* key, const char* expected) {
  size_t length = key->key_end - key->key_start;

  return length == strlen(expected) && strncmp(content->bytes + key->key_start, expected, length) == 0;
}

static size_t find_signature_close(const directive_content_T* content, const size_t opening_paren) {
  int depth = 0;

  for (size_t offset = opening_paren; offset < content->length; offset++) {
    if (content->bytes[offset] == '(') {
      depth++;
    } else if (content->bytes[offset] == ')') {
      depth--;

      if (depth == 0) { return offset; }
    }
  }

  return content->length;
}

static hb_string_T directive_kind_for_prism_node(const pm_node_t* node) {
  if (!node) { return hb_string("missing"); }

  switch (node->type) {
    case PM_TRUE_NODE:
    case PM_FALSE_NODE: return hb_string("boolean");
    case PM_INTEGER_NODE: return hb_string("integer");
    case PM_FLOAT_NODE: return hb_string("float");
    case PM_STRING_NODE: return hb_string("string");
    case PM_SYMBOL_NODE: return hb_string("symbol");
    case PM_NIL_NODE: return hb_string("nil");
    case PM_ARRAY_NODE: return hb_string("array");
    case PM_HASH_NODE:
    case PM_KEYWORD_HASH_NODE: return hb_string("hash");
    case PM_LOCAL_VARIABLE_READ_NODE: return hb_string("bare");

    case PM_CALL_NODE: {
      const pm_call_node_t* call = (const pm_call_node_t*) node;

      if (!call->receiver && !call->arguments && !call->block) { return hb_string("bare"); }

      return hb_string("seeded");
    }

    default: return hb_string("seeded");
  }
}

typedef struct {
  const uint8_t* synthetic_start;
  size_t signature_start;
  size_t prefix_length;
} synthetic_mapping_T;

static size_t synthetic_to_content_offset(const synthetic_mapping_T* mapping, const uint8_t* pointer) {
  size_t offset = (size_t) (pointer - mapping->synthetic_start);

  if (offset < mapping->prefix_length) { return mapping->signature_start; }

  return mapping->signature_start + offset - mapping->prefix_length;
}

static AST_RUBY_LITERAL_NODE_T* create_default_value_node(
  const directive_content_T* content,
  const synthetic_mapping_T* mapping,
  const pm_node_t* value,
  hb_allocator_T* allocator
) {
  size_t start = synthetic_to_content_offset(mapping, value->location.start);
  size_t end = synthetic_to_content_offset(mapping, value->location.end);

  char* source = hb_allocator_strndup(allocator, content->bytes + start, end - start);

  AST_RUBY_LITERAL_NODE_T* literal = ast_ruby_literal_node_init(
    hb_string_from_c_string(source),
    content_position(content, start),
    content_position(content, end),
    hb_array_init(0, allocator),
    allocator
  );

  hb_allocator_dealloc(allocator, source);

  return literal;
}

static void append_state_declaration(
  hb_array_T* states,
  const directive_content_T* content,
  const synthetic_mapping_T* mapping,
  const pm_node_t* keyword,
  hb_array_T** errors,
  hb_allocator_T* allocator,
  const parser_options_T* options
) {
  pm_location_t name_location;
  const pm_node_t* value = NULL;

  if (keyword->type == PM_OPTIONAL_KEYWORD_PARAMETER_NODE) {
    const pm_optional_keyword_parameter_node_t* optional = (const pm_optional_keyword_parameter_node_t*) keyword;
    name_location = optional->name_loc;
    value = optional->value;
  } else if (keyword->type == PM_REQUIRED_KEYWORD_PARAMETER_NODE) {
    name_location = ((const pm_required_keyword_parameter_node_t*) keyword)->name_loc;
  } else {
    return;
  }

  size_t name_start = synthetic_to_content_offset(mapping, name_location.start);
  size_t name_end = synthetic_to_content_offset(mapping, name_location.end);

  if (name_end > name_start && content->bytes[name_end - 1] == ':') { name_end--; }

  size_t declaration_start = synthetic_to_content_offset(mapping, keyword->location.start);
  size_t declaration_end = synthetic_to_content_offset(mapping, keyword->location.end);

  if (!value) {
    append_herb_state_invalid_parameter_error(
      content_slice(content, declaration_start, declaration_end),
      content_position(content, declaration_start),
      content_position(content, declaration_end),
      allocator,
      errors,
      options
    );
  }

  token_T* name = content_token(content, name_start, name_end, TOKEN_IDENTIFIER, allocator);
  AST_RUBY_LITERAL_NODE_T* default_value = value ? create_default_value_node(content, mapping, value, allocator) : NULL;

  AST_HERB_STATE_DECLARATION_NODE_T* declaration = ast_herb_state_declaration_node_init(
    name,
    default_value,
    directive_kind_for_prism_node(value),
    content_position(content, declaration_start),
    content_position(content, declaration_end),
    hb_array_init(0, allocator),
    allocator
  );

  hb_array_append(states, declaration);
}

static void append_invalid_parameter_error(
  const directive_content_T* content,
  const synthetic_mapping_T* mapping,
  const pm_node_t* parameter,
  hb_array_T** errors,
  hb_allocator_T* allocator,
  const parser_options_T* options
) {
  if (!parameter) { return; }

  size_t start = synthetic_to_content_offset(mapping, parameter->location.start);
  size_t end = synthetic_to_content_offset(mapping, parameter->location.end);

  append_herb_state_invalid_parameter_error(
    content_slice(content, start, end),
    content_position(content, start),
    content_position(content, end),
    allocator,
    errors,
    options
  );
}

static hb_array_T* extract_state_declarations(
  const pm_parameters_node_t* parameters,
  const directive_content_T* content,
  const synthetic_mapping_T* mapping,
  hb_array_T** errors,
  hb_allocator_T* allocator,
  const parser_options_T* options
) {
  if (!parameters) { return hb_array_init(0, allocator); }

  hb_array_T* states = hb_array_init(parameters->keywords.size, allocator);

  for (size_t index = 0; index < parameters->requireds.size; index++) {
    append_invalid_parameter_error(content, mapping, parameters->requireds.nodes[index], errors, allocator, options);
  }

  for (size_t index = 0; index < parameters->optionals.size; index++) {
    append_invalid_parameter_error(content, mapping, parameters->optionals.nodes[index], errors, allocator, options);
  }

  for (size_t index = 0; index < parameters->posts.size; index++) {
    append_invalid_parameter_error(content, mapping, parameters->posts.nodes[index], errors, allocator, options);
  }

  append_invalid_parameter_error(content, mapping, parameters->rest, errors, allocator, options);
  append_invalid_parameter_error(content, mapping, parameters->keyword_rest, errors, allocator, options);
  append_invalid_parameter_error(content, mapping, (const pm_node_t*) parameters->block, errors, allocator, options);

  for (size_t index = 0; index < parameters->keywords.size; index++) {
    append_state_declaration(states, content, mapping, parameters->keywords.nodes[index], errors, allocator, options);
  }

  return states;
}

static const pm_parameters_node_t* find_parameters_node(const pm_node_t* root) {
  if (!root || root->type != PM_PROGRAM_NODE) { return NULL; }

  const pm_program_node_t* program = (const pm_program_node_t*) root;
  if (!program->statements || program->statements->body.size == 0) { return NULL; }

  const pm_node_t* first = program->statements->body.nodes[0];
  if (!first || first->type != PM_DEF_NODE) { return NULL; }

  return ((const pm_def_node_t*) first)->parameters;
}

static size_t skip_quoted(const directive_content_T* content, const size_t start, const size_t end) {
  char quote = content->bytes[start];
  size_t offset = start + 1;

  while (offset < end) {
    if (content->bytes[offset] == '\\') {
      offset += 2;
      continue;
    }

    if (content->bytes[offset] == quote) { return offset + 1; }

    offset++;
  }

  return end;
}

static void append_normalized_signature(
  hb_buffer_T* buffer,
  const directive_content_T* content,
  const size_t signature_start,
  const size_t signature_end
) {
  size_t offset = signature_start;
  bool pending_space = false;

  while (offset < signature_end) {
    char character = content->bytes[offset];

    if (character == '"' || character == '\'') {
      size_t closing = skip_quoted(content, offset, signature_end);

      if (pending_space) { hb_buffer_append(buffer, " "); }

      hb_buffer_append_with_length(buffer, content->bytes + offset, closing - offset);
      pending_space = false;
      offset = closing;

      continue;
    }

    if (is_whitespace(character)) {
      pending_space = true;
      offset++;

      continue;
    }

    if (pending_space && character != ')' && character != ',') { hb_buffer_append(buffer, " "); }

    pending_space = false;

    if (character == '(') {
      hb_buffer_append(buffer, "(");
      offset++;

      while (offset < signature_end && is_whitespace(content->bytes[offset])) {
        offset++;
      }

      continue;
    }

    hb_buffer_append_with_length(buffer, content->bytes + offset, 1);
    offset++;
  }
}

static bool append_canonical_directive(
  hb_buffer_T* buffer,
  const directive_content_T* content,
  const size_t signature_start,
  const size_t signature_end,
  hb_allocator_T* allocator
) {
  if (!hb_buffer_init(buffer, signature_end - signature_start + 32, allocator)) { return false; }

  hb_buffer_append(buffer, CANONICAL_TAG_OPENING " " HERB_DIRECTIVE_PREFIX HERB_STATE_DIRECTIVE_KEY " ");
  append_normalized_signature(buffer, content, signature_start, signature_end);
  hb_buffer_append(buffer, " " CANONICAL_TAG_CLOSING);

  return true;
}

static bool append_directive_source(
  hb_buffer_T* buffer,
  const AST_ERB_CONTENT_NODE_T* erb_node,
  const directive_content_T* content,
  hb_allocator_T* allocator
) {
  if (!hb_buffer_init(buffer, content->length + 8, allocator)) { return false; }

  if (erb_node->tag_opening) {
    hb_buffer_append_with_length(buffer, erb_node->tag_opening->value.data, erb_node->tag_opening->value.length);
  }

  hb_buffer_append_with_length(buffer, content->bytes, content->length);

  if (erb_node->tag_closing) {
    hb_buffer_append_with_length(buffer, erb_node->tag_closing->value.data, erb_node->tag_closing->value.length);
  }

  return true;
}

static hb_string_T buffer_string(const hb_buffer_T* buffer) {
  return hb_string_from_data(hb_buffer_value(buffer), hb_buffer_length(buffer));
}

static bool token_value_equals(const token_T* token, hb_string_T expected) {
  return token && hb_string_equals(token->value, expected);
}

static bool is_single_space(const directive_content_T* content, const size_t start, const size_t end) {
  return end == start + 1 && content->bytes[start] == ' ';
}

static bool content_has_newline(const directive_content_T* content, const size_t start, const size_t end) {
  for (size_t offset = start; offset < end; offset++) {
    if (content->bytes[offset] == '\n') { return true; }
  }

  return false;
}

static void report_non_canonical(
  const AST_ERB_CONTENT_NODE_T* erb_node,
  const directive_content_T* content,
  const directive_key_T* key,
  const size_t signature_start,
  const size_t signature_end,
  hb_array_T** errors,
  hb_allocator_T* allocator,
  const parser_options_T* options
) {
  position_T start;
  position_T end;

  if (!token_value_equals(erb_node->tag_opening, hb_string(CANONICAL_TAG_OPENING))) {
    start = erb_node->tag_opening->location.start;
    end = erb_node->tag_opening->location.end;
  } else if (!is_single_space(content, 0, key->key_start - strlen(HERB_DIRECTIVE_PREFIX))) {
    start = content_position(content, 0);
    end = content_position(content, key->key_start - strlen(HERB_DIRECTIVE_PREFIX));
  } else if (!is_single_space(content, key->key_end, signature_start)) {
    start = content_position(content, key->key_end);
    end = content_position(content, signature_start);
  } else if (content_has_newline(content, signature_start, signature_end)) {
    start = content_position(content, signature_start);
    end = content_position(content, signature_end);
  } else if (!is_single_space(content, signature_end, content->length)) {
    start = content_position(content, signature_end);
    end = content_position(content, content->length);
  } else if (!token_value_equals(erb_node->tag_closing, hb_string(CANONICAL_TAG_CLOSING))) {
    start = erb_node->tag_closing->location.start;
    end = erb_node->tag_closing->location.end;
  } else {
    return;
  }

  hb_buffer_T found;
  hb_buffer_T expected;

  if (!append_directive_source(&found, erb_node, content, allocator)) { return; }

  if (!append_canonical_directive(&expected, content, signature_start, signature_end, allocator)) {
    hb_buffer_free(&found);

    return;
  }

  append_herb_state_non_canonical_directive_error(
    buffer_string(&found),
    buffer_string(&expected),
    start,
    end,
    allocator,
    errors,
    options
  );

  hb_buffer_free(&found);
  hb_buffer_free(&expected);
}

static AST_NODE_T* create_herb_state_directive_node(
  AST_ERB_CONTENT_NODE_T* erb_node,
  const directive_content_T* content,
  const directive_key_T* key,
  hb_allocator_T* allocator,
  const parser_options_T* options
) {
  hb_array_T* errors = hb_array_init(0, allocator);
  size_t after_key = skip_whitespace(content, key->key_end);

  if (after_key >= content->length || content->bytes[after_key] != '(') {
    size_t rest_end = trim_trailing_whitespace(content, after_key, content->length);

    append_herb_state_missing_parenthesis_error(
      content_slice(content, after_key, rest_end),
      content_position(content, after_key),
      content_position(content, rest_end),
      allocator,
      &errors,
      options
    );

    return (AST_NODE_T*) ast_herb_state_directive_node_init(
      token_copy(erb_node->tag_opening, allocator),
      token_copy(erb_node->content, allocator),
      token_copy(erb_node->tag_closing, allocator),
      content_token(content, key->key_start, key->key_end, TOKEN_IDENTIFIER, allocator),
      NULL,
      hb_array_init(0, allocator),
      erb_node->base.location.start,
      erb_node->base.location.end,
      errors,
      allocator
    );
  }

  size_t signature_start = after_key;
  size_t signature_end = find_signature_close(content, signature_start);

  if (signature_end < content->length) { signature_end++; }

  report_non_canonical(erb_node, content, key, signature_start, signature_end, &errors, allocator, options);

  hb_buffer_T synthetic;
  size_t signature_length = signature_end - signature_start;

  if (!hb_buffer_init(
        &synthetic,
        strlen(SYNTHETIC_PREFIX) + signature_length + strlen(SYNTHETIC_SUFFIX) + 1,
        allocator
      )) {
    return NULL;
  }

  hb_buffer_append(&synthetic, SYNTHETIC_PREFIX);
  hb_buffer_append_with_length(&synthetic, content->bytes + signature_start, signature_length);
  hb_buffer_append(&synthetic, SYNTHETIC_SUFFIX);

  pm_parser_t parser;
  pm_options_t prism_options = { 0 };

  pm_parser_init(&parser, (const uint8_t*) hb_buffer_value(&synthetic), hb_buffer_length(&synthetic), &prism_options);

  pm_node_t* root = pm_parse(&parser);

  synthetic_mapping_T mapping = {
    .synthetic_start = parser.start,
    .signature_start = signature_start,
    .prefix_length = strlen(SYNTHETIC_PREFIX),
  };

  bool parsed = true;

  for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) parser.error_list.head; error != NULL;
       error = (const pm_diagnostic_t*) error->node.next) {
    if (error->diag_id == PM_ERR_DEF_TERM) { continue; }

    parsed = false;

    position_T error_start = content_position(content, synthetic_to_content_offset(&mapping, error->location.start));
    position_T error_end = content_position(content, synthetic_to_content_offset(&mapping, error->location.end));

    hb_array_append(errors, ruby_parse_error_from_prism_error_with_positions(error, error_start, error_end, allocator));
  }

  hb_array_T* states =
    parsed ? extract_state_declarations(find_parameters_node(root), content, &mapping, &errors, allocator, options)
           : hb_array_init(0, allocator);

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);
  pm_options_free(&prism_options);
  hb_buffer_free(&synthetic);

  return (AST_NODE_T*) ast_herb_state_directive_node_init(
    token_copy(erb_node->tag_opening, allocator),
    token_copy(erb_node->content, allocator),
    token_copy(erb_node->tag_closing, allocator),
    content_token(content, key->key_start, key->key_end, TOKEN_IDENTIFIER, allocator),
    content_token(content, signature_start, signature_end, TOKEN_ERB_CONTENT, allocator),
    states,
    erb_node->base.location.start,
    erb_node->base.location.end,
    errors,
    allocator
  );
}

static AST_NODE_T* create_herb_directive_node(
  AST_ERB_CONTENT_NODE_T* erb_node,
  const directive_content_T* content,
  const directive_key_T* key,
  hb_allocator_T* allocator
) {
  size_t arguments_start = skip_whitespace(content, key->key_end);
  size_t arguments_end = trim_trailing_whitespace(content, arguments_start, content->length);

  token_T* arguments = arguments_end > arguments_start
                       ? content_token(content, arguments_start, arguments_end, TOKEN_ERB_CONTENT, allocator)
                       : NULL;

  return (AST_NODE_T*) ast_herb_directive_node_init(
    token_copy(erb_node->tag_opening, allocator),
    token_copy(erb_node->content, allocator),
    token_copy(erb_node->tag_closing, allocator),
    content_token(content, key->key_start, key->key_end, TOKEN_IDENTIFIER, allocator),
    arguments,
    erb_node->base.location.start,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );
}

static bool is_erb_comment_node(const AST_ERB_CONTENT_NODE_T* node) {
  if (!node->tag_opening || !node->content) { return false; }
  if (hb_string_is_empty(node->tag_opening->value)) { return false; }

  hb_string_T opening = node->tag_opening->value;

  for (uint32_t index = 0; index < opening.length; index++) {
    if (opening.data[index] == '#') { return true; }
  }

  return false;
}

static void transform_herb_directives_in_array(hb_array_T* array, analyze_ruby_context_T* context) {
  if (!array) { return; }

  AST_NODE_T* first_state_directive = NULL;

  for (size_t index = 0; index < hb_array_size(array); index++) {
    AST_NODE_T* child = hb_array_get(array, index);
    if (!child || child->type != AST_ERB_CONTENT_NODE) { continue; }

    AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) child;

    if (!is_erb_comment_node(erb_node)) { continue; }

    directive_content_T content = {
      .bytes = erb_node->content->value.data,
      .length = (size_t) erb_node->content->value.length,
      .base_offset = calculate_byte_offset_from_position(context->source, erb_node->content->location.start),
      .source = context->source,
    };

    directive_key_T key;

    if (!find_directive_key(&content, &key)) { continue; }

    AST_NODE_T* directive_node;

    if (key_equals(&content, &key, HERB_STATE_DIRECTIVE_KEY)) {
      directive_node = create_herb_state_directive_node(erb_node, &content, &key, context->allocator, context->options);

      if (directive_node) {
        if (first_state_directive) {
          append_herb_state_duplicate_declaration_error(
            directive_node->location.start,
            directive_node->location.end,
            context->allocator,
            &directive_node->errors,
            context->options
          );
        } else {
          first_state_directive = directive_node;
        }
      }
    } else {
      directive_node = create_herb_directive_node(erb_node, &content, &key, context->allocator);
    }

    if (!directive_node) { continue; }

    hb_array_set(array, index, directive_node);

    ast_node_free(child, context->allocator);
  }
}

bool transform_herb_directive_nodes(const AST_NODE_T* node, void* data) {
  analyze_ruby_context_T* context = (analyze_ruby_context_T*) data;

  transform_herb_directives_in_array(get_node_children_array(node), context);

  herb_visit_child_nodes(node, transform_herb_directive_nodes, data);

  return false;
}
