#include "include/analyze_tag_helpers.h"
#include "include/analyze.h"
#include "include/array.h"
#include "include/ast_nodes.h"
#include "include/location.h"
#include "include/position.h"
#include "include/prism_helpers.h"
#include "include/range.h"
#include "include/tag_helper_handler.h"
#include "include/token_struct.h"
#include "include/util.h"

#include <ctype.h>
#include <prism.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

bool search_tag_helper_node(const pm_node_t* node, void* data) {
  tag_helper_search_data_T* search_data = (tag_helper_search_data_T*) data;

  if (node->type == PM_CALL_NODE) {
    pm_call_node_t* call_node = (pm_call_node_t*) node;
    tag_helper_handler_T* handlers = get_tag_helper_handlers();
    size_t handlers_count = get_tag_helper_handlers_count();

    for (size_t i = 0; i < handlers_count; i++) {
      if (handlers[i].detect(call_node, search_data->parser)) {
        search_data->tag_helper_node = node;
        search_data->matched_handler = &handlers[i];
        search_data->found = true;

        if (search_data->info) {
          search_data->info->call_node = call_node;
          search_data->info->tag_name = handlers[i].extract_tag_name(call_node, search_data->parser);
          search_data->info->content = handlers[i].extract_content(call_node, search_data->parser);
          search_data->info->has_block = handlers[i].supports_block();
        }

        return true;
      }
    }
  }

  pm_visit_child_nodes(node, search_tag_helper_node, search_data);

  return search_data->found;
}

bool is_tag_helper(const char* content) {
  if (!content) { return false; }

  pm_parser_t parser;
  const uint8_t* source = (const uint8_t*) content;
  pm_parser_init(&parser, source, strlen(content), NULL);

  pm_node_t* root = pm_parse(&parser);

  if (!root) {
    pm_parser_free(&parser);
    return false;
  }

  tag_helper_search_data_T data = { .tag_helper_node = NULL, .source = source, .parser = &parser, .found = false };

  pm_visit_node(root, search_tag_helper_node, &data);

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);

  return data.found;
}

char* extract_tag_name_from_call_node(pm_node_t* node, const uint8_t* source) {
  if (!node || !source || node->type != PM_CALL_NODE) { return NULL; }

  pm_call_node_t* call_node = (pm_call_node_t*) node;
  tag_helper_handler_T* handlers = get_tag_helper_handlers();
  size_t handlers_count = get_tag_helper_handlers_count();

  pm_parser_t parser;
  pm_parser_init(&parser, source, strlen((const char*) source), NULL);

  for (size_t i = 0; i < handlers_count; i++) {
    if (handlers[i].detect(call_node, &parser)) {
      char* tag_name = handlers[i].extract_tag_name(call_node, &parser);
      pm_parser_free(&parser);
      return tag_name;
    }
  }

  pm_parser_free(&parser);
  return NULL;
}

char* extract_tag_name_from_helper(const char* content) {
  if (!content) { return NULL; }

  pm_parser_t parser;
  const uint8_t* source = (const uint8_t*) content;
  pm_parser_init(&parser, source, strlen(content), NULL);

  pm_node_t* root = pm_parse(&parser);
  if (!root) {
    pm_parser_free(&parser);
    return NULL;
  }

  tag_helper_info_T* info = tag_helper_info_init();
  tag_helper_search_data_T search_data = { .tag_helper_node = NULL,
                                           .source = source,
                                           .parser = &parser,
                                           .info = info,
                                           .found = false };

  pm_visit_node(root, search_tag_helper_node, &search_data);

  char* tag_name = NULL;
  if (search_data.found && info->tag_name) { tag_name = herb_strdup(info->tag_name); }

  tag_helper_info_free(&info);
  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);

  return tag_name;
}

AST_RUBY_LITERAL_NODE_T* create_ruby_literal_node(const char* content, position_T* start_pos, position_T* end_pos) {
  if (!content) { return NULL; }

  return ast_ruby_literal_node_init(content, start_pos, end_pos, array_init(8));
}

AST_HTML_ATTRIBUTE_RUBY_SPLAT_NODE_T* create_html_attribute_ruby_splat_node(
  const char* content, const char* prefix, position_T* start_pos, position_T* end_pos
) {
  if (!content) { return NULL; }

  return ast_html_attribute_ruby_splat_node_init(content, prefix, start_pos, end_pos, array_init(8));
}

AST_HTML_ATTRIBUTE_VALUE_NODE_T* create_interpolated_attribute_value(
  pm_interpolated_string_node_t* interpolated_node, position_T* start_pos, position_T* end_pos
) {
  if (!interpolated_node) { return NULL; }

  array_T* value_children = array_init(8);

  for (size_t i = 0; i < interpolated_node->parts.size; i++) {
    pm_node_t* part = interpolated_node->parts.nodes[i];

    if (part->type == PM_STRING_NODE) {
      pm_string_node_t* string_part = (pm_string_node_t*) part;
      size_t content_length = pm_string_length(&string_part->unescaped);

      if (content_length > 0) {
        char* content = calloc(content_length + 1, sizeof(char));
        if (content) {
          memcpy(content, pm_string_source(&string_part->unescaped), content_length);
          AST_LITERAL_NODE_T* literal_node = ast_literal_node_init(content, start_pos, end_pos, array_init(8));

          if (literal_node) { array_append(value_children, (AST_NODE_T*) literal_node); }

          free(content);
        }
      }
    } else if (part->type == PM_EMBEDDED_STATEMENTS_NODE) {
      size_t ruby_length = part->location.end - part->location.start;
      char* ruby_content = calloc(ruby_length + 1, sizeof(char));

      if (ruby_content) {
        memcpy(ruby_content, (const char*) part->location.start, ruby_length);

        AST_RUBY_LITERAL_NODE_T* ruby_node = create_ruby_literal_node(ruby_content, start_pos, end_pos);

        if (ruby_node) { array_append(value_children, (AST_NODE_T*) ruby_node); }

        free(ruby_content);
      }
    }
  }

  return ast_html_attribute_value_node_init(NULL, value_children, NULL, false, start_pos, end_pos, array_init(8));
}

position_T* byte_offset_to_position(const char* source, size_t offset) {
  if (!source) { return NULL; }

  position_T* position = calloc(1, sizeof(position_T));
  position->line = 1;
  position->column = 0;

  for (size_t i = 0; i < offset && source[i] != '\0'; i++) {
    if (source[i] == '\n') {
      position->line++;
      position->column = 0;
    } else {
      position->column++;
    }
  }

  return position;
}

// Helper function to convert Prism location to position_T with ERB offset
position_T* prism_location_to_position_with_offset(
  const pm_location_t* pm_loc, const char* original_source, size_t erb_content_offset, const uint8_t* erb_content_source
) {
  if (!pm_loc || !original_source || !erb_content_source) { return NULL; }

  size_t offset_in_erb = (size_t) (pm_loc->start - erb_content_source);

  size_t total_offset = erb_content_offset + offset_in_erb;

  return byte_offset_to_position(original_source, total_offset);
}

AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_with_interpolated_value_from_assoc_node(
  pm_assoc_node_t* assoc, const char* name_string, pm_interpolated_string_node_t* interpolated_node,
  const char* original_source, size_t erb_content_offset, const uint8_t* source
) {
  if (!assoc || !name_string || !interpolated_node) { return NULL; }

  position_T* name_start =
    prism_location_to_position_with_offset(&assoc->key->location, original_source, erb_content_offset, source);
  position_T* name_end =
    prism_location_to_position_with_offset(&assoc->key->location, original_source, erb_content_offset, source);

  if (name_end) {
    size_t total_end_offset = erb_content_offset + (assoc->key->location.end - source);
    free(name_end);
    name_end = byte_offset_to_position(original_source, total_end_offset);
  }

  // TODO: add helper in token.c
  token_T* name_token = calloc(1, sizeof(token_T));
  name_token->value = herb_strdup(name_string);
  name_token->type = TOKEN_IDENTIFIER;
  name_token->location = location_init(name_start, name_end);
  name_token->range = range_init(0, 0);

  AST_HTML_ATTRIBUTE_NAME_NODE_T* name_node =
    ast_html_attribute_name_node_init(name_token, name_start, name_end, array_init(8));

  position_T* equals_start = position_copy(name_end);
  position_T* equals_end =
    prism_location_to_position_with_offset(&assoc->value->location, original_source, erb_content_offset, source);

  const char* operator_str = ":";
  token_type_T operator_type = TOKEN_COLON;

  token_T* equals_token = calloc(1, sizeof(token_T));
  equals_token->value = herb_strdup(operator_str);
  equals_token->type = operator_type;
  equals_token->location = location_init(equals_start, equals_end);
  equals_token->range = range_init(0, 0);

  position_T* value_start =
    prism_location_to_position_with_offset(&assoc->value->location, original_source, erb_content_offset, source);
  position_T* value_end =
    prism_location_to_position_with_offset(&assoc->value->location, original_source, erb_content_offset, source);

  if (value_end) {
    size_t total_end_offset = erb_content_offset + (assoc->value->location.end - source);
    free(value_end);
    value_end = byte_offset_to_position(original_source, total_end_offset);
  }

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node =
    create_interpolated_attribute_value(interpolated_node, value_start, value_end);

  AST_HTML_ATTRIBUTE_NODE_T* attr_node =
    ast_html_attribute_node_init(name_node, equals_token, value_node, name_start, value_end, array_init(8));

  if (name_start) { free(name_start); }
  if (name_end) { free(name_end); }
  if (equals_start) { free(equals_start); }
  if (equals_end) { free(equals_end); }
  if (value_start) { free(value_start); }
  if (value_end) { free(value_end); }

  return attr_node;
}

AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_with_interpolated_value(
  const char* name_string, pm_interpolated_string_node_t* interpolated_node, position_T* start_pos, position_T* end_pos
) {
  if (!name_string || !interpolated_node) { return NULL; }

  token_T* name_token = calloc(1, sizeof(token_T));
  name_token->value = herb_strdup(name_string);
  name_token->type = TOKEN_IDENTIFIER;
  name_token->location = location_init(start_pos, end_pos);
  name_token->range = range_init(0, 0);

  AST_HTML_ATTRIBUTE_NAME_NODE_T* name_node =
    ast_html_attribute_name_node_init(name_token, start_pos, end_pos, array_init(8));

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node =
    create_interpolated_attribute_value(interpolated_node, start_pos, end_pos);

  token_T* equals_token = calloc(1, sizeof(token_T));
  equals_token->value = herb_strdup("=");
  equals_token->type = TOKEN_EQUALS;
  equals_token->location = location_init(start_pos, end_pos);
  equals_token->range = range_init(0, 0);

  AST_HTML_ATTRIBUTE_NODE_T* attr_node =
    ast_html_attribute_node_init(name_node, equals_token, value_node, start_pos, end_pos, array_init(8));

  return attr_node;
}

position_T* prism_location_to_position(const pm_location_t* pm_loc) {
  if (!pm_loc) { return NULL; }

  position_T* pos = calloc(1, sizeof(position_T));
  pos->line = 1;
  pos->column = 0;
  return pos;
}

AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_with_ruby_literal_from_assoc_node(
  pm_assoc_node_t* assoc, const char* name_string, const char* ruby_content, const char* original_source,
  size_t erb_content_offset, const uint8_t* source
) {
  if (!assoc || !name_string || !ruby_content) { return NULL; }

  position_T* name_start =
    prism_location_to_position_with_offset(&assoc->key->location, original_source, erb_content_offset, source);
  position_T* name_end =
    prism_location_to_position_with_offset(&assoc->key->location, original_source, erb_content_offset, source);
  if (name_end) {
    size_t total_end_offset = erb_content_offset + (assoc->key->location.end - source);
    free(name_end);
    name_end = byte_offset_to_position(original_source, total_end_offset);
  }

  token_T* name_token = calloc(1, sizeof(token_T));
  name_token->value = herb_strdup(name_string);
  name_token->type = TOKEN_IDENTIFIER;
  name_token->location = location_init(name_start, name_end);
  name_token->range = range_init(0, 0);

  AST_HTML_ATTRIBUTE_NAME_NODE_T* name_node =
    ast_html_attribute_name_node_init(name_token, name_start, name_end, array_init(8));

  position_T* equals_start = position_copy(name_end);
  position_T* equals_end =
    prism_location_to_position_with_offset(&assoc->value->location, original_source, erb_content_offset, source);

  const char* operator_str = ":";
  token_type_T operator_type = TOKEN_COLON;

  token_T* equals_token = calloc(1, sizeof(token_T));
  equals_token->value = herb_strdup(operator_str);
  equals_token->type = operator_type;
  equals_token->location = location_init(equals_start, equals_end);
  equals_token->range = range_init(0, 0);

  position_T* value_start =
    prism_location_to_position_with_offset(&assoc->value->location, original_source, erb_content_offset, source);
  position_T* value_end =
    prism_location_to_position_with_offset(&assoc->value->location, original_source, erb_content_offset, source);

  if (value_end) {
    size_t total_end_offset = erb_content_offset + (assoc->value->location.end - source);
    free(value_end);
    value_end = byte_offset_to_position(original_source, total_end_offset);
  }

  AST_RUBY_LITERAL_NODE_T* ruby_node = create_ruby_literal_node(ruby_content, value_start, value_end);

  array_T* value_children = array_init(8);
  array_append(value_children, (AST_NODE_T*) ruby_node);

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node =
    ast_html_attribute_value_node_init(NULL, value_children, NULL, false, value_start, value_end, array_init(8));

  AST_HTML_ATTRIBUTE_NODE_T* attr_node =
    ast_html_attribute_node_init(name_node, equals_token, value_node, name_start, value_end, array_init(8));

  if (name_start) { free(name_start); }
  if (name_end) { free(name_end); }
  if (equals_start) { free(equals_start); }
  if (equals_end) { free(equals_end); }
  if (value_start) { free(value_start); }
  if (value_end) { free(value_end); }

  return attr_node;
}

AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_with_ruby_literal(
  const char* name_string, const char* ruby_content, position_T* start_pos, position_T* end_pos
) {
  if (!name_string || !ruby_content) { return NULL; }

  token_T* name_token = calloc(1, sizeof(token_T));
  name_token->value = herb_strdup(name_string);
  name_token->type = TOKEN_IDENTIFIER;
  name_token->location = location_init(start_pos, end_pos);
  name_token->range = range_init(0, 0);

  AST_HTML_ATTRIBUTE_NAME_NODE_T* name_node =
    ast_html_attribute_name_node_init(name_token, start_pos, end_pos, array_init(8));

  AST_RUBY_LITERAL_NODE_T* ruby_node = create_ruby_literal_node(ruby_content, start_pos, end_pos);

  array_T* value_children = array_init(8);
  array_append(value_children, (AST_NODE_T*) ruby_node);

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node =
    ast_html_attribute_value_node_init(NULL, value_children, NULL, false, start_pos, end_pos, array_init(8));

  token_T* equals_token = calloc(1, sizeof(token_T));
  equals_token->value = herb_strdup("=");
  equals_token->type = TOKEN_EQUALS;
  equals_token->location = location_init(start_pos, end_pos);
  equals_token->range = range_init(0, 0);

  AST_HTML_ATTRIBUTE_NODE_T* attr_node =
    ast_html_attribute_node_init(name_node, equals_token, value_node, start_pos, end_pos, array_init(8));

  return attr_node;
}

AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_from_assoc_node(
  pm_assoc_node_t* assoc, const char* name_string, const char* value_str, const char* original_source,
  size_t erb_content_offset, const uint8_t* source
) {
  if (!assoc || !name_string || !value_str) { return NULL; }

  position_T* name_start =
    prism_location_to_position_with_offset(&assoc->key->location, original_source, erb_content_offset, source);
  position_T* name_end =
    prism_location_to_position_with_offset(&assoc->key->location, original_source, erb_content_offset, source);

  if (name_end) {
    size_t total_end_offset = erb_content_offset + (assoc->key->location.end - source);
    free(name_end);
    name_end = byte_offset_to_position(original_source, total_end_offset);
  }

  // TODO: add helper in token.c
  token_T* name_token = calloc(1, sizeof(token_T));
  name_token->value = herb_strdup(name_string);
  name_token->type = TOKEN_IDENTIFIER;
  name_token->location = location_init(name_start, name_end);
  name_token->range = range_init(0, 0);

  AST_HTML_ATTRIBUTE_NAME_NODE_T* name_node =
    ast_html_attribute_name_node_init(name_token, name_start, name_end, array_init(8));

  // Create equals token with position between key and value
  // Find the operator position (: or =) by looking between key and value locations
  position_T* equals_start = position_copy(name_end);
  position_T* equals_end =
    prism_location_to_position_with_offset(&assoc->value->location, original_source, erb_content_offset, source);

  // Determine operator type based on Ruby syntax (: for symbols, = for hash rockets)
  const char* operator_str = ":";
  token_type_T operator_type = TOKEN_COLON;

  // TODO: add helper in token.c
  token_T* equals_token = calloc(1, sizeof(token_T));
  equals_token->value = herb_strdup(operator_str);
  equals_token->type = operator_type;
  equals_token->location = location_init(equals_start, equals_end);
  equals_token->range = range_init(0, 0);

  // Create value node with precise value location
  position_T* value_start =
    prism_location_to_position_with_offset(&assoc->value->location, original_source, erb_content_offset, source);
  position_T* value_end =
    prism_location_to_position_with_offset(&assoc->value->location, original_source, erb_content_offset, source);

  if (value_end) {
    size_t total_end_offset = erb_content_offset + (assoc->value->location.end - source);
    free(value_end);
    value_end = byte_offset_to_position(original_source, total_end_offset);
  }

  AST_HTML_TEXT_NODE_T* text_node = ast_html_text_node_init(value_str, value_start, value_end, array_init(8));

  array_T* value_children = array_init(8);
  array_append(value_children, (AST_NODE_T*) text_node);

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node =
    ast_html_attribute_value_node_init(NULL, value_children, NULL, false, value_start, value_end, array_init(8));

  AST_HTML_ATTRIBUTE_NODE_T* attr_node =
    ast_html_attribute_node_init(name_node, equals_token, value_node, name_start, value_end, array_init(8));

  if (name_start) { free(name_start); }
  if (name_end) { free(name_end); }
  if (equals_start) { free(equals_start); }
  if (equals_end) { free(equals_end); }
  if (value_start) { free(value_start); }
  if (value_end) { free(value_end); }

  return attr_node;
}

// TODO: reimplement this - fallback for backward compatibility
AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_node(
  const char* name_string, const char* value_str, position_T* start_pos, position_T* end_pos
) {
  if (!name_string || !value_str) { return NULL; }

  token_T* name_token = calloc(1, sizeof(token_T));
  name_token->value = herb_strdup(name_string);
  name_token->type = TOKEN_IDENTIFIER;
  name_token->location = location_init(start_pos, end_pos);
  name_token->range = range_init(0, 0);

  AST_HTML_ATTRIBUTE_NAME_NODE_T* name_node =
    ast_html_attribute_name_node_init(name_token, start_pos, end_pos, array_init(8));

  AST_HTML_TEXT_NODE_T* text_node = ast_html_text_node_init(value_str, start_pos, end_pos, array_init(8));

  array_T* value_children = array_init(8);
  array_append(value_children, (AST_NODE_T*) text_node);

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node =
    ast_html_attribute_value_node_init(NULL, value_children, NULL, false, start_pos, end_pos, array_init(8));

  token_T* equals_token = calloc(1, sizeof(token_T));
  equals_token->value = herb_strdup("=");
  equals_token->type = TOKEN_EQUALS;
  equals_token->location = location_init(start_pos, end_pos);
  equals_token->range = range_init(0, 0);

  AST_HTML_ATTRIBUTE_NODE_T* attr_node =
    ast_html_attribute_node_init(name_node, equals_token, value_node, start_pos, end_pos, array_init(8));

  return attr_node;
}

array_T* extract_keyword_arguments_from_call_node(
  pm_node_t* node, const uint8_t* source, const char* original_source, size_t erb_content_offset
) {
  array_T* attributes = array_init(8);

  if (!node || !source || node->type != PM_CALL_NODE) { return attributes; }

  pm_call_node_t* call_node = (pm_call_node_t*) node;
  if (!call_node->arguments) { return attributes; }

  pm_arguments_node_t* args = call_node->arguments;

  if (args->arguments.size > 0) {
    pm_node_t* last_arg = args->arguments.nodes[args->arguments.size - 1];

    if (last_arg->type == PM_KEYWORD_HASH_NODE) {
      pm_keyword_hash_node_t* kw_hash = (pm_keyword_hash_node_t*) last_arg;

      for (size_t j = 0; j < kw_hash->elements.size; j++) {
        pm_node_t* element = kw_hash->elements.nodes[j];

        if (element->type == PM_ASSOC_SPLAT_NODE) {
          // Handle splat nodes like **attributes
          pm_assoc_splat_node_t* splat = (pm_assoc_splat_node_t*) element;

          // Extract the splat expression using position-based source extraction
          size_t splat_length = splat->base.location.end - splat->base.location.start;
          char* splat_content = calloc(splat_length + 1, sizeof(char));
          if (splat_content) {
            memcpy(splat_content, (const char*) splat->base.location.start, splat_length);

            // Create HTMLAttributeRubySplatNode with precise location tracking
            position_T* splat_start = prism_location_to_position_with_offset(
              &splat->base.location,
              original_source,
              erb_content_offset,
              source
            );
            position_T* splat_end = prism_location_to_position_with_offset(
              &splat->base.location,
              original_source,
              erb_content_offset,
              source
            );
            if (splat_end) {
              // Adjust end position to end of splat expression
              size_t total_end_offset = erb_content_offset + (splat->base.location.end - source);
              free(splat_end);
              splat_end = byte_offset_to_position(original_source, total_end_offset);
            }
            AST_HTML_ATTRIBUTE_RUBY_SPLAT_NODE_T* splat_ruby_node =
              create_html_attribute_ruby_splat_node(splat_content, "", splat_start, splat_end);
            if (splat_start) { free(splat_start); }
            if (splat_end) { free(splat_end); }
            if (splat_ruby_node) { array_append(attributes, (AST_NODE_T*) splat_ruby_node); }

            free(splat_content);
          }
        } else if (element->type == PM_ASSOC_NODE) {
          pm_assoc_node_t* assoc = (pm_assoc_node_t*) element;

          char* key_str = NULL;
          char* value_str = NULL;

          if (assoc->key->type == PM_SYMBOL_NODE) {
            pm_symbol_node_t* symbol = (pm_symbol_node_t*) assoc->key;
            size_t key_length = pm_string_length(&symbol->unescaped);
            key_str = calloc(key_length + 1, sizeof(char));
            memcpy(key_str, pm_string_source(&symbol->unescaped), key_length);
          }

          // Special handling for data and aria attributes
          if (key_str && (strcmp(key_str, "data") == 0 || strcmp(key_str, "aria") == 0)
              && assoc->value->type == PM_HASH_NODE) {
            pm_hash_node_t* hash = (pm_hash_node_t*) assoc->value;
            const char* prefix = key_str; // "data" or "aria"
            size_t prefix_len = strlen(prefix);

            // Iterate through hash elements and create data-* or aria-* attributes
            for (size_t k = 0; k < hash->elements.size; k++) {
              pm_node_t* hash_element = hash->elements.nodes[k];
              if (hash_element->type == PM_ASSOC_SPLAT_NODE) {
                // Handle splat nodes within data/aria hashes like **data_attributes
                pm_assoc_splat_node_t* hash_splat = (pm_assoc_splat_node_t*) hash_element;

                // Extract the splat expression using position-based source extraction
                size_t hash_splat_length = hash_splat->base.location.end - hash_splat->base.location.start;
                char* hash_splat_content = calloc(hash_splat_length + 1, sizeof(char));
                if (hash_splat_content) {
                  memcpy(hash_splat_content, (const char*) hash_splat->base.location.start, hash_splat_length);

                  // Create HTMLAttributeRubySplatNode with precise location tracking
                  position_T* hash_splat_start = prism_location_to_position_with_offset(
                    &hash_splat->base.location,
                    original_source,
                    erb_content_offset,
                    source
                  );
                  position_T* hash_splat_end = prism_location_to_position_with_offset(
                    &hash_splat->base.location,
                    original_source,
                    erb_content_offset,
                    source
                  );
                  if (hash_splat_end) {
                    // Adjust end position to end of splat expression
                    size_t total_end_offset = erb_content_offset + (hash_splat->base.location.end - source);
                    free(hash_splat_end);
                    hash_splat_end = byte_offset_to_position(original_source, total_end_offset);
                  }
                  AST_HTML_ATTRIBUTE_RUBY_SPLAT_NODE_T* hash_splat_ruby_node =
                    create_html_attribute_ruby_splat_node(hash_splat_content, prefix, hash_splat_start, hash_splat_end);
                  if (hash_splat_start) { free(hash_splat_start); }
                  if (hash_splat_end) { free(hash_splat_end); }
                  if (hash_splat_ruby_node) { array_append(attributes, (AST_NODE_T*) hash_splat_ruby_node); }

                  free(hash_splat_content);
                }
              } else if (hash_element->type == PM_ASSOC_NODE) {
                pm_assoc_node_t* hash_assoc = (pm_assoc_node_t*) hash_element;

                char* attr_key_str = NULL;
                char* attr_value_str = NULL;

                // Extract attribute key (can be symbol or string)
                if (hash_assoc->key->type == PM_SYMBOL_NODE) {
                  pm_symbol_node_t* attr_symbol = (pm_symbol_node_t*) hash_assoc->key;
                  size_t attr_key_length = pm_string_length(&attr_symbol->unescaped);
                  char* raw_key = calloc(attr_key_length + 1, sizeof(char));
                  memcpy(raw_key, pm_string_source(&attr_symbol->unescaped), attr_key_length);

                  // Create prefix-* attribute name (data-* or aria-*)
                  attr_key_str = calloc(
                    prefix_len + 1 + attr_key_length + 1,
                    sizeof(char)
                  ); // prefix + "-" + key + null
                  snprintf(attr_key_str, prefix_len + 1 + attr_key_length + 1, "%s-%s", prefix, raw_key);
                  free(raw_key);
                } else if (hash_assoc->key->type == PM_STRING_NODE) {
                  pm_string_node_t* attr_string = (pm_string_node_t*) hash_assoc->key;
                  size_t attr_key_length = pm_string_length(&attr_string->unescaped);
                  char* raw_key = calloc(attr_key_length + 1, sizeof(char));
                  memcpy(raw_key, pm_string_source(&attr_string->unescaped), attr_key_length);

                  // Create prefix-* attribute name (data-* or aria-*)
                  attr_key_str = calloc(
                    prefix_len + 1 + attr_key_length + 1,
                    sizeof(char)
                  ); // prefix + "-" + key + null
                  snprintf(attr_key_str, prefix_len + 1 + attr_key_length + 1, "%s-%s", prefix, raw_key);
                  free(raw_key);
                }

                // Extract attribute value
                if (hash_assoc->value->type == PM_STRING_NODE) {
                  pm_string_node_t* attr_string = (pm_string_node_t*) hash_assoc->value;
                  size_t attr_value_length = pm_string_length(&attr_string->unescaped);
                  attr_value_str = calloc(attr_value_length + 1, sizeof(char));
                  memcpy(attr_value_str, pm_string_source(&attr_string->unescaped), attr_value_length);

                  if (attr_key_str && attr_value_str) {
                    // Use enhanced attribute creation with granular location tracking
                    AST_HTML_ATTRIBUTE_NODE_T* attr = create_html_attribute_from_assoc_node(
                      hash_assoc,
                      attr_key_str,
                      attr_value_str,
                      original_source,
                      erb_content_offset,
                      source
                    );
                    if (attr) { array_append(attributes, (AST_NODE_T*) attr); }
                  }
                } else {
                  // Handle complex attribute values as Ruby literals
                  size_t attr_value_length = hash_assoc->value->location.end - hash_assoc->value->location.start;
                  char* ruby_content = calloc(attr_value_length + 1, sizeof(char));
                  if (ruby_content && attr_key_str) {
                    memcpy(ruby_content, (const char*) hash_assoc->value->location.start, attr_value_length);
                    // Use enhanced Ruby literal attribute creation with granular location tracking
                    AST_HTML_ATTRIBUTE_NODE_T* attr = create_html_attribute_with_ruby_literal_from_assoc_node(
                      hash_assoc,
                      attr_key_str,
                      ruby_content,
                      original_source,
                      erb_content_offset,
                      source
                    );
                    if (attr) { array_append(attributes, (AST_NODE_T*) attr); }
                    free(ruby_content);
                  }
                }

                if (attr_key_str) { free(attr_key_str); }
                if (attr_value_str) { free(attr_value_str); }
              }
            }
          } else if (assoc->value->type == PM_STRING_NODE) {
            pm_string_node_t* string = (pm_string_node_t*) assoc->value;
            size_t value_length = pm_string_length(&string->unescaped);
            value_str = calloc(value_length + 1, sizeof(char));
            memcpy(value_str, pm_string_source(&string->unescaped), value_length);

            if (key_str && value_str) {
              char* dashed_key = convert_underscores_to_dashes(key_str);
              // Use enhanced attribute creation with granular location tracking
              AST_HTML_ATTRIBUTE_NODE_T* attr = create_html_attribute_from_assoc_node(
                assoc,
                dashed_key ? dashed_key : key_str,
                value_str,
                original_source,
                erb_content_offset,
                source
              );
              if (attr) { array_append(attributes, (AST_NODE_T*) attr); }
              if (dashed_key) { free(dashed_key); }
            }
          } else if (assoc->value->type == PM_INTERPOLATED_STRING_NODE) {
            // Handle interpolated strings by breaking them into LiteralNode and RubyLiteralNode pieces
            pm_interpolated_string_node_t* interpolated = (pm_interpolated_string_node_t*) assoc->value;

            if (key_str) {
              char* dashed_key = convert_underscores_to_dashes(key_str);
              // Use enhanced interpolated string attribute creation with granular location tracking
              AST_HTML_ATTRIBUTE_NODE_T* attr = create_html_attribute_with_interpolated_value_from_assoc_node(
                assoc,
                dashed_key ? dashed_key : key_str,
                interpolated,
                original_source,
                erb_content_offset,
                source
              );
              if (attr) { array_append(attributes, (AST_NODE_T*) attr); }
              if (dashed_key) { free(dashed_key); }
            }
          } else {
            // Handle complex/dynamic values as Ruby literals - extract from source using position
            size_t value_length = assoc->value->location.end - assoc->value->location.start;
            char* ruby_content = calloc(value_length + 1, sizeof(char));
            if (ruby_content && key_str) {
              memcpy(ruby_content, (const char*) assoc->value->location.start, value_length);
              char* dashed_key = convert_underscores_to_dashes(key_str);
              // Use enhanced Ruby literal attribute creation with granular location tracking
              AST_HTML_ATTRIBUTE_NODE_T* attr = create_html_attribute_with_ruby_literal_from_assoc_node(
                assoc,
                dashed_key ? dashed_key : key_str,
                ruby_content,
                original_source,
                erb_content_offset,
                source
              );
              if (attr) { array_append(attributes, (AST_NODE_T*) attr); }
              if (dashed_key) { free(dashed_key); }
              free(ruby_content);
            }
          }

          if (key_str) { free(key_str); }
          if (value_str) { free(value_str); }
        }
      }
    }
  }

  return attributes;
}

array_T* extract_keyword_arguments_from_helper(
  const char* content, position_T* default_pos, const char* original_source, size_t erb_content_offset
) {
  array_T* attributes = array_init(8);

  if (!content) { return attributes; }

  pm_parser_t parser;
  const uint8_t* source = (const uint8_t*) content;
  pm_parser_init(&parser, source, strlen(content), NULL);

  pm_node_t* root = pm_parse(&parser);
  if (!root) {
    pm_parser_free(&parser);
    return attributes;
  }

  tag_helper_search_data_T search_data = { .tag_helper_node = NULL,
                                           .source = source,
                                           .parser = &parser,
                                           .info = NULL,
                                           .found = false };

  pm_visit_node(root, search_tag_helper_node, &search_data);

  if (search_data.found && search_data.tag_helper_node) {
    array_T* extracted_attrs = extract_keyword_arguments_from_call_node(
      (pm_node_t*) search_data.tag_helper_node,
      source,
      original_source,
      erb_content_offset
    );

    for (size_t i = 0; i < array_size(extracted_attrs); i++) {
      array_append(attributes, array_get(extracted_attrs, i));
    }

    array_free(&extracted_attrs);
  }

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);

  return attributes;
}

char* extract_tag_helper_content(const char* content) {
  if (!content) { return NULL; }

  pm_parser_t parser;
  const uint8_t* source = (const uint8_t*) content;
  pm_parser_init(&parser, source, strlen(content), NULL);

  pm_node_t* root = pm_parse(&parser);
  if (!root) {
    pm_parser_free(&parser);
    return NULL;
  }

  tag_helper_info_T* info = tag_helper_info_init();
  tag_helper_search_data_T search_data = { .tag_helper_node = NULL,
                                           .source = source,
                                           .parser = &parser,
                                           .info = info,
                                           .found = false };

  pm_visit_node(root, search_tag_helper_node, &search_data);

  char* helper_content = NULL;
  if (search_data.found && info->content) { helper_content = herb_strdup(info->content); }

  tag_helper_info_free(&info);
  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);

  return helper_content;
}

bool has_tag_helper_block(AST_ERB_BLOCK_NODE_T* block_node) {
  if (!block_node || !block_node->content || !block_node->content->value) { return false; }

  return is_tag_helper(block_node->content->value);
}

bool is_tag_helper_block(const char* content, AST_ERB_CONTENT_NODE_T* erb_node) {
  if (!content || !erb_node) { return false; }

  if (!is_tag_helper(content)) { return false; }

  analyzed_ruby_T* ruby = erb_node->analyzed_ruby;
  if (!ruby || ruby->valid) { return true; }

  return true;
}

bool has_tag_helper_attributes(const char* content) {
  if (!content) { return false; }

  pm_parser_t parser;
  const uint8_t* source = (const uint8_t*) content;
  pm_parser_init(&parser, source, strlen(content), NULL);

  pm_node_t* root = pm_parse(&parser);
  if (!root) {
    pm_parser_free(&parser);
    return false;
  }

  tag_helper_search_data_T search_data = { .tag_helper_node = NULL,
                                           .source = source,
                                           .parser = &parser,
                                           .info = NULL,
                                           .found = false };

  pm_visit_node(root, search_tag_helper_node, &search_data);

  bool has_attrs = false;
  if (search_data.found && search_data.tag_helper_node && search_data.tag_helper_node->type == PM_CALL_NODE) {
    pm_call_node_t* call_node = (pm_call_node_t*) search_data.tag_helper_node;
    if (call_node->arguments && call_node->arguments->arguments.size > 0) {
      pm_node_t* last_arg = call_node->arguments->arguments.nodes[call_node->arguments->arguments.size - 1];
      if (last_arg->type == PM_KEYWORD_HASH_NODE) { has_attrs = true; }
    }
  }

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);

  return has_attrs;
}

// Determine the source string for a tag helper by inspecting the call node
static const char* get_handler_source_for_content(const char* content) {
  if (!content) { return "ActionView"; }
  pm_parser_t parser;
  const uint8_t* src = (const uint8_t*) content;
  pm_parser_init(&parser, src, strlen(content), NULL);
  pm_node_t* root = pm_parse(&parser);
  const char* result = "ActionView";
  if (root) {
    tag_helper_handler_T* handlers = get_tag_helper_handlers();
    size_t handlers_count = get_tag_helper_handlers_count();

    tag_helper_search_data_T search_data = { .tag_helper_node = NULL,
                                             .source = src,
                                             .parser = &parser,
                                             .info = NULL,
                                             .found = false };

    pm_visit_node(root, search_tag_helper_node, &search_data);

    if (search_data.found && search_data.tag_helper_node->type == PM_CALL_NODE) {
      pm_call_node_t* call_node = (pm_call_node_t*) search_data.tag_helper_node;

      for (size_t i = 0; i < handlers_count; i++) {
        if (handlers[i].detect(call_node, &parser)) {
          result = handlers[i].source;
          break;
        }
      }
    }

    pm_node_destroy(&parser, root);
  }

  pm_parser_free(&parser);
  return result;
}

AST_NODE_T* transform_tag_helper_with_attributes(AST_ERB_CONTENT_NODE_T* erb_node, analyze_ruby_context_T* context) {
  if (!erb_node || !erb_node->content || !erb_node->content->value) { return NULL; }

  char* tag_name = extract_tag_name_from_helper(erb_node->content->value);
  if (!tag_name) { return NULL; }

  token_T* tag_name_token = calloc(1, sizeof(token_T));
  tag_name_token->value = herb_strdup(tag_name);
  tag_name_token->type = TOKEN_IDENTIFIER;
  tag_name_token->location = location_copy(erb_node->content->location);
  tag_name_token->range = range_copy(erb_node->content->range);

  array_T* children = array_init(8);

  size_t erb_block_start =
    calculate_byte_offset_from_position(context->original_source, erb_node->base.location->start);
  size_t tag_opening_length = strlen(erb_node->tag_opening->value);
  size_t erb_content_offset = erb_block_start + tag_opening_length;

  array_T* attributes = extract_keyword_arguments_from_helper(
    erb_node->content->value,
    erb_node->base.location->start,
    context->original_source,
    erb_content_offset
  );
  for (size_t i = 0; i < array_size(attributes); i++) {
    array_append(children, array_get(attributes, i));
  }
  array_free(&attributes);

  array_T* erb_errors = array_init(8);

  AST_ERB_OPEN_TAG_NODE_T* erb_open_tag = ast_erb_open_tag_node_init(
    token_copy(erb_node->tag_opening),
    token_copy(erb_node->content),
    token_copy(erb_node->tag_closing),
    tag_name_token,
    children,
    erb_node->base.location->start,
    erb_node->tag_closing->location->end,
    erb_errors
  );

  array_T* body = array_init(8);

  char* text_content = extract_tag_helper_content(erb_node->content->value);
  if (text_content) {
    AST_HTML_TEXT_NODE_T* text_node = ast_html_text_node_init(
      text_content,
      erb_node->base.location->start,
      erb_node->base.location->start,
      array_init(8)
    );
    array_append(body, (AST_NODE_T*) text_node);
    free(text_content);
  }

  array_T* element_errors = array_init(8);

  position_T* element_start = position_copy(erb_node->base.location->start);
  position_T* element_end = position_copy(erb_node->tag_closing->location->end);

  const char* source_string = get_handler_source_for_content(erb_node->content->value);
  AST_HTML_ELEMENT_NODE_T* element_node = ast_html_element_node_init(
    (AST_NODE_T*) erb_open_tag,
    tag_name_token,
    body,
    NULL,
    false,
    source_string,
    element_start,
    element_end,
    element_errors
  );

  free(tag_name);

  return (AST_NODE_T*) element_node;
}

AST_NODE_T* transform_simple_tag_helper(AST_ERB_CONTENT_NODE_T* erb_node, analyze_ruby_context_T* context) {
  if (!erb_node || !erb_node->content || !erb_node->content->value) { return NULL; }

  char* tag_name = extract_tag_name_from_helper(erb_node->content->value);
  if (!tag_name) { return NULL; }

  token_T* tag_name_token = calloc(1, sizeof(token_T));
  tag_name_token->value = herb_strdup(tag_name);
  tag_name_token->type = TOKEN_IDENTIFIER;
  tag_name_token->location = location_copy(erb_node->content->location);
  tag_name_token->range = range_copy(erb_node->content->range);

  array_T* children = array_init(8);

  size_t erb_block_start =
    calculate_byte_offset_from_position(context->original_source, erb_node->base.location->start);
  size_t tag_opening_length = strlen(erb_node->tag_opening->value);
  size_t erb_content_offset = erb_block_start + tag_opening_length;

  array_T* attributes = extract_keyword_arguments_from_helper(
    erb_node->content->value,
    erb_node->base.location->start,
    context->original_source,
    erb_content_offset
  );
  for (size_t i = 0; i < array_size(attributes); i++) {
    array_append(children, array_get(attributes, i));
  }
  array_free(&attributes);

  array_T* simple_erb_errors = array_init(8);

  AST_ERB_OPEN_TAG_NODE_T* erb_open_tag = ast_erb_open_tag_node_init(
    token_copy(erb_node->tag_opening),
    token_copy(erb_node->content),
    token_copy(erb_node->tag_closing),
    tag_name_token,
    children,
    erb_node->base.location->start,
    erb_node->tag_closing->location->end,
    simple_erb_errors
  );

  array_T* body = array_init(8);

  char* text_content = extract_tag_helper_content(erb_node->content->value);
  if (text_content) {
    AST_HTML_TEXT_NODE_T* text_node = ast_html_text_node_init(
      text_content,
      erb_node->base.location->start,
      erb_node->base.location->start,
      array_init(8)
    );
    array_append(body, (AST_NODE_T*) text_node);
    free(text_content);
  }

  array_T* simple_element_errors = array_init(8);

  position_T* element_start = position_copy(erb_node->base.location->start);
  position_T* element_end = position_copy(erb_node->tag_closing->location->end);
  const char* source_string = get_handler_source_for_content(erb_node->content->value);
  AST_HTML_ELEMENT_NODE_T* element_node = ast_html_element_node_init(
    (AST_NODE_T*) erb_open_tag,
    tag_name_token,
    body,
    NULL,
    false,
    source_string,
    element_start,
    element_end,
    simple_element_errors
  );

  free(tag_name);

  return (AST_NODE_T*) element_node;
}

AST_NODE_T* transform_erb_block_to_tag_helper(AST_ERB_BLOCK_NODE_T* block_node, analyze_ruby_context_T* context) {
  if (!block_node || !block_node->content || !block_node->content->value) { return NULL; }

  const char* content = block_node->content->value;
  char* tag_name = extract_tag_name_from_helper(content);
  if (!tag_name) { return NULL; }

  token_T* tag_name_token = calloc(1, sizeof(token_T));
  tag_name_token->value = herb_strdup(tag_name);
  tag_name_token->type = TOKEN_IDENTIFIER;
  tag_name_token->location = location_copy(block_node->content->location);
  tag_name_token->range = range_copy(block_node->content->range);

  array_T* children = array_init(8);

  size_t erb_block_start =
    calculate_byte_offset_from_position(context->original_source, block_node->base.location->start);
  size_t tag_opening_length = strlen(block_node->tag_opening->value);
  size_t erb_content_offset = erb_block_start + tag_opening_length;

  // Special handling for link_to to extract href attribute
  if (strcmp(tag_name, "a") == 0) {
    pm_parser_t parser;
    const uint8_t* source = (const uint8_t*) content;
    pm_parser_init(&parser, source, strlen(content), NULL);

    pm_node_t* root = pm_parse(&parser);
    if (root) {
      tag_helper_search_data_T search_data = { .tag_helper_node = NULL,
                                               .source = source,
                                               .parser = &parser,
                                               .info = NULL,
                                               .found = false };

      pm_visit_node(root, search_tag_helper_node, &search_data);

      if (search_data.found && search_data.tag_helper_node->type == PM_CALL_NODE) {
        pm_call_node_t* call_node = (pm_call_node_t*) search_data.tag_helper_node;

        // Extract href from first argument
        if (call_node->arguments && call_node->arguments->arguments.size >= 1) {
          pm_node_t* first_arg = call_node->arguments->arguments.nodes[0];

          if (first_arg->type == PM_STRING_NODE) {
            // Static string href
            pm_string_node_t* string_node = (pm_string_node_t*) first_arg;
            size_t length = pm_string_length(&string_node->unescaped);
            char* href_value = calloc(length + 1, sizeof(char));
            memcpy(href_value, pm_string_source(&string_node->unescaped), length);

            position_T* href_start = prism_location_to_position_with_offset(
              &first_arg->location,
              context->original_source,
              erb_content_offset,
              source
            );
            position_T* href_end = prism_location_to_position_with_offset(
              &first_arg->location,
              context->original_source,
              erb_content_offset,
              source
            );
            AST_HTML_ATTRIBUTE_NODE_T* href_attr = create_html_attribute_node("href", href_value, href_start, href_end);
            if (href_attr) { array_append(children, (AST_NODE_T*) href_attr); }
            if (href_start) { free(href_start); }
            if (href_end) { free(href_end); }

            free(href_value);
          } else {
            // Dynamic expression href - extract the Ruby code
            size_t source_length = first_arg->location.end - first_arg->location.start;
            char* ruby_expr = calloc(source_length + 1, sizeof(char));
            memcpy(ruby_expr, (const char*) first_arg->location.start, source_length);

            position_T* href_start = prism_location_to_position_with_offset(
              &first_arg->location,
              context->original_source,
              erb_content_offset,
              source
            );
            position_T* href_end = prism_location_to_position_with_offset(
              &first_arg->location,
              context->original_source,
              erb_content_offset,
              source
            );
            AST_HTML_ATTRIBUTE_NODE_T* href_attr =
              create_html_attribute_with_ruby_literal("href", ruby_expr, href_start, href_end);
            if (href_attr) { array_append(children, (AST_NODE_T*) href_attr); }
            if (href_start) { free(href_start); }
            if (href_end) { free(href_end); }

            free(ruby_expr);
          }
        }
      }

      pm_node_destroy(&parser, root);
    }
    pm_parser_free(&parser);
  }

  array_T* attributes = extract_keyword_arguments_from_helper(
    content,
    block_node->base.location->start,
    context->original_source,
    erb_content_offset
  );
  for (size_t i = 0; i < array_size(attributes); i++) {
    array_append(children, array_get(attributes, i));
  }
  array_free(&attributes);

  array_T* erb_errors = array_init(8);

  AST_ERB_OPEN_TAG_NODE_T* erb_open_tag = ast_erb_open_tag_node_init(
    token_copy(block_node->tag_opening),
    token_copy(block_node->content),
    token_copy(block_node->tag_closing),
    tag_name_token,
    children,
    block_node->base.location->start,
    block_node->tag_closing->location->end,
    erb_errors
  );

  array_T* body = array_init(array_size(block_node->body));

  char* text_content = extract_tag_helper_content(content);
  if (text_content) {
    AST_HTML_TEXT_NODE_T* text_node = ast_html_text_node_init(
      text_content,
      block_node->base.location->start,
      block_node->base.location->end,
      array_init(8)
    );
    array_append(body, (AST_NODE_T*) text_node);
    free(text_content);
  }

  for (size_t i = 0; i < array_size(block_node->body); i++) {
    array_append(body, array_get(block_node->body, i));
  }

  const char* source_string = get_handler_source_for_content(content);
  AST_HTML_ELEMENT_NODE_T* element_node = ast_html_element_node_init(
    (AST_NODE_T*) erb_open_tag,
    token_copy(tag_name_token),
    body,
    (struct AST_HTML_CLOSE_TAG_NODE_STRUCT*) block_node->end_node,
    false,
    source_string,
    block_node->base.location->start,
    block_node->base.location->end,
    array_init(8)
  );

  free(tag_name);
  return (AST_NODE_T*) element_node;
}

// Special transformation for link_to helper
AST_NODE_T* transform_link_to_helper(AST_ERB_CONTENT_NODE_T* erb_node, analyze_ruby_context_T* context) {
  if (!erb_node || !erb_node->content || !erb_node->content->value) { return NULL; }

  const char* content = erb_node->content->value;

  pm_parser_t parser;
  const uint8_t* source = (const uint8_t*) content;
  pm_parser_init(&parser, source, strlen(content), NULL);

  pm_node_t* root = pm_parse(&parser);
  if (!root) {
    pm_parser_free(&parser);
    return NULL;
  }

  // Find the link_to call node
  tag_helper_search_data_T search_data = { .tag_helper_node = NULL,
                                           .source = source,
                                           .parser = &parser,
                                           .info = NULL,
                                           .found = false };

  pm_visit_node(root, search_tag_helper_node, &search_data);

  if (!search_data.found || !search_data.tag_helper_node || search_data.tag_helper_node->type != PM_CALL_NODE) {
    pm_node_destroy(&parser, root);
    pm_parser_free(&parser);
    return NULL;
  }

  pm_call_node_t* call_node = (pm_call_node_t*) search_data.tag_helper_node;

  // Create the <a> tag name token
  token_T* tag_name_token = calloc(1, sizeof(token_T));
  tag_name_token->value = herb_strdup("a");
  tag_name_token->type = TOKEN_IDENTIFIER;
  tag_name_token->location = location_copy(erb_node->content->location);
  tag_name_token->range = range_copy(erb_node->content->range);

  array_T* children = array_init(8);

  // Handle href attribute
  if (call_node->arguments && call_node->arguments->arguments.size >= 2) {
    pm_node_t* second_arg = call_node->arguments->arguments.nodes[1];

    if (second_arg->type == PM_STRING_NODE) {
      // Static string href
      pm_string_node_t* string_node = (pm_string_node_t*) second_arg;
      size_t length = pm_string_length(&string_node->unescaped);
      char* href_value = calloc(length + 1, sizeof(char));
      memcpy(href_value, pm_string_source(&string_node->unescaped), length);

      AST_HTML_ATTRIBUTE_NODE_T* href_attr =
        create_html_attribute_node("href", href_value, erb_node->base.location->start, erb_node->base.location->end);
      if (href_attr) { array_append(children, (AST_NODE_T*) href_attr); }

      free(href_value);
    } else {
      // Dynamic expression href - extract the Ruby code
      size_t source_length = second_arg->location.end - second_arg->location.start;
      char* ruby_expr = calloc(source_length + 1, sizeof(char));
      memcpy(ruby_expr, (const char*) second_arg->location.start, source_length);

      // Create href attribute with RubyLiteralNode
      AST_HTML_ATTRIBUTE_NODE_T* href_attr = create_html_attribute_with_ruby_literal(
        "href",
        ruby_expr,
        erb_node->base.location->start,
        erb_node->base.location->end
      );
      if (href_attr) { array_append(children, (AST_NODE_T*) href_attr); }

      free(ruby_expr);
    }
  } else if (call_node->arguments && call_node->arguments->arguments.size == 1) {
    // Single argument form: link_to(url) with no content
    pm_node_t* first_arg = call_node->arguments->arguments.nodes[0];

    if (first_arg->type == PM_STRING_NODE) {
      // Static string href
      pm_string_node_t* string_node = (pm_string_node_t*) first_arg;
      size_t length = pm_string_length(&string_node->unescaped);
      char* href_value = calloc(length + 1, sizeof(char));
      memcpy(href_value, pm_string_source(&string_node->unescaped), length);

      AST_HTML_ATTRIBUTE_NODE_T* href_attr =
        create_html_attribute_node("href", href_value, erb_node->base.location->start, erb_node->base.location->end);
      if (href_attr) { array_append(children, (AST_NODE_T*) href_attr); }

      free(href_value);
    } else {
      // Dynamic expression href
      size_t source_length = first_arg->location.end - first_arg->location.start;
      char* ruby_expr = calloc(source_length + 1, sizeof(char));
      memcpy(ruby_expr, (const char*) first_arg->location.start, source_length);

      AST_HTML_ATTRIBUTE_NODE_T* href_attr = create_html_attribute_with_ruby_literal(
        "href",
        ruby_expr,
        erb_node->base.location->start,
        erb_node->base.location->end
      );
      if (href_attr) { array_append(children, (AST_NODE_T*) href_attr); }

      free(ruby_expr);
    }
  }

  // Add keyword arguments as HTML attributes
  array_T* keyword_attributes =
    extract_keyword_arguments_from_call_node((pm_node_t*) call_node, source, context->original_source, 0);
  for (size_t i = 0; i < array_size(keyword_attributes); i++) {
    array_append(children, array_get(keyword_attributes, i));
  }
  array_free(&keyword_attributes);

  // Create ERB open tag
  AST_ERB_OPEN_TAG_NODE_T* erb_open_tag = ast_erb_open_tag_node_init(
    token_copy(erb_node->tag_opening),
    token_copy(erb_node->content),
    token_copy(erb_node->tag_closing),
    tag_name_token,
    children,
    erb_node->base.location->start,
    erb_node->tag_closing->location->end,
    array_init(8)
  );

  // Handle content
  array_T* body = array_init(8);

  // Extract text content from first argument if present
  if (call_node->arguments && call_node->arguments->arguments.size >= 1) {
    pm_node_t* first_arg = call_node->arguments->arguments.nodes[0];

    if (first_arg->type == PM_STRING_NODE && call_node->arguments->arguments.size >= 2) {
      // Two arguments: link_to("Content", url)
      pm_string_node_t* string_node = (pm_string_node_t*) first_arg;
      size_t length = pm_string_length(&string_node->unescaped);
      char* text_content = calloc(length + 1, sizeof(char));
      memcpy(text_content, pm_string_source(&string_node->unescaped), length);

      AST_HTML_TEXT_NODE_T* text_node = ast_html_text_node_init(
        text_content,
        erb_node->base.location->start,
        erb_node->base.location->end,
        array_init(8)
      );
      array_append(body, (AST_NODE_T*) text_node);

      free(text_content);
    }
  }

  // Create HTML element
  const char* source_string = get_handler_source_for_content(erb_node->content->value);
  AST_HTML_ELEMENT_NODE_T* element_node = ast_html_element_node_init(
    (AST_NODE_T*) erb_open_tag,
    tag_name_token,
    body,
    NULL,
    false,
    source_string,
    erb_node->base.location->start,
    erb_node->base.location->end,
    array_init(8)
  );

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);

  return (AST_NODE_T*) element_node;
}
