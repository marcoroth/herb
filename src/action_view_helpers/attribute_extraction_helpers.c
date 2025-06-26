#include "../include/analyze_tag_helpers.h"
#include "../include/array.h"
#include "../include/prism_helpers.h"
#include "../include/tag_helper_handler.h"
#include "../include/util.h"

// Extract a single HTML attribute from a Prism association node
AST_HTML_ATTRIBUTE_NODE_T* extract_html_attribute_from_assoc(
  pm_assoc_node_t* assoc, const uint8_t* source, const char* original_source, size_t erb_content_offset
) {
  if (!assoc || assoc->key->type != PM_SYMBOL_NODE) { return NULL; }

  pm_symbol_node_t* symbol = (pm_symbol_node_t*) assoc->key;

  // Extract symbol content using Prism API
  size_t name_length = pm_string_length(&symbol->unescaped);
  char* name_string = calloc(name_length + 1, sizeof(char));
  if (!name_string) { return NULL; }
  memcpy(name_string, pm_string_source(&symbol->unescaped), name_length);

  // Use simple position for now - following existing patterns in the codebase
  position_T* default_pos = position_init(1, 1);

  AST_HTML_ATTRIBUTE_NODE_T* attr_node = NULL;

  // Special handling for data and aria attributes
  if (name_string && (strcmp(name_string, "data") == 0 || strcmp(name_string, "aria") == 0)
      && assoc->value->type == PM_HASH_NODE) {
    // For data/aria hash attributes, we'll return NULL for now since this function
    // only handles single attributes. The caller should use extract_html_attributes_from_keyword_hash
    // which can handle expanding data/aria hashes into multiple attributes.
    free(name_string);
    position_free(default_pos);

    return NULL;
  } else if (assoc->value->type == PM_STRING_NODE) {
    pm_string_node_t* string = (pm_string_node_t*) assoc->value;

    // Extract string content using Prism API
    size_t value_length = pm_string_length(&string->unescaped);
    char* value_str = calloc(value_length + 1, sizeof(char));
    if (value_str) {
      memcpy(value_str, pm_string_source(&string->unescaped), value_length);
      char* dashed_name = convert_underscores_to_dashes(name_string);
      attr_node = create_html_attribute_node(dashed_name ? dashed_name : name_string, value_str, default_pos, default_pos);

      if (dashed_name) { free(dashed_name); }
      free(value_str);
    }
  } else if (assoc->value->type == PM_INTERPOLATED_STRING_NODE) {
    // Handle interpolated strings by breaking them into LiteralNode and RubyLiteralNode pieces
    pm_interpolated_string_node_t* interpolated = (pm_interpolated_string_node_t*) assoc->value;
    char* dashed_name = convert_underscores_to_dashes(name_string);

    attr_node = create_html_attribute_with_interpolated_value(
      dashed_name ? dashed_name : name_string,
      interpolated,
      default_pos,
      default_pos
    );

    if (dashed_name) { free(dashed_name); }
  } else {
    // Handle complex/dynamic values as Ruby literals - use location pointers directly
    size_t value_length = assoc->value->location.end - assoc->value->location.start;
    char* ruby_content = calloc(value_length + 1, sizeof(char));

    if (ruby_content) {
      memcpy(ruby_content, (const char*) assoc->value->location.start, value_length);
      char* dashed_name = convert_underscores_to_dashes(name_string);

      attr_node = create_html_attribute_with_ruby_literal(
        dashed_name ? dashed_name : name_string,
        ruby_content,
        default_pos,
        default_pos
      );

      if (dashed_name) { free(dashed_name); }

      free(ruby_content);
    }
  }

  free(name_string);
  position_free(default_pos);

  return attr_node;
}

// Extract all HTML attributes from a keyword hash node
array_T* extract_html_attributes_from_keyword_hash(
  pm_keyword_hash_node_t* kw_hash, const uint8_t* source, const char* original_source, size_t erb_content_offset
) {
  if (!kw_hash) { return NULL; }

  array_T* attributes = array_init(8);
  if (!attributes) { return NULL; }

  for (size_t i = 0; i < kw_hash->elements.size; i++) {
    pm_node_t* element = kw_hash->elements.nodes[i];
    if (element->type == PM_ASSOC_SPLAT_NODE) {
      // Handle splat nodes like **attributes
      pm_assoc_splat_node_t* splat = (pm_assoc_splat_node_t*) element;

      // Extract the splat expression using position-based source extraction
      size_t splat_length = splat->base.location.end - splat->base.location.start;
      char* splat_content = calloc(splat_length + 1, sizeof(char));
      if (splat_content) {
        memcpy(splat_content, (const char*) splat->base.location.start, splat_length);

        position_T* splat_pos = position_init(1, 1);
        // Create RubyLiteralNode directly and add it to attributes array
        AST_RUBY_LITERAL_NODE_T* splat_ruby_node =
          ast_ruby_literal_node_init(splat_content, splat_pos, splat_pos, array_init(8));

        if (splat_ruby_node) { array_append(attributes, (AST_NODE_T*) splat_ruby_node); }

        free(splat_content);
        position_free(splat_pos);
      }
    } else if (element->type == PM_ASSOC_NODE) {
      pm_assoc_node_t* assoc = (pm_assoc_node_t*) element;

      // Check if this is a data or aria hash that needs expansion
      char* key_str = NULL;

      if (assoc->key->type == PM_SYMBOL_NODE) {
        pm_symbol_node_t* symbol = (pm_symbol_node_t*) assoc->key;
        size_t key_length = pm_string_length(&symbol->unescaped);
        key_str = calloc(key_length + 1, sizeof(char));

        if (key_str) { memcpy(key_str, pm_string_source(&symbol->unescaped), key_length); }
      }

      if (key_str && (strcmp(key_str, "data") == 0 || strcmp(key_str, "aria") == 0)
          && assoc->value->type == PM_HASH_NODE) {
        // Expand data/aria hash into individual data-*/aria-* attributes
        pm_hash_node_t* hash = (pm_hash_node_t*) assoc->value;
        const char* prefix = key_str; // "data" or "aria"
        size_t prefix_len = strlen(prefix);

        for (size_t j = 0; j < hash->elements.size; j++) {
          pm_node_t* hash_element = hash->elements.nodes[j];
          if (hash_element->type == PM_ASSOC_SPLAT_NODE) {
            // Handle splat nodes within data/aria hashes like **data_attributes
            pm_assoc_splat_node_t* hash_splat = (pm_assoc_splat_node_t*) hash_element;

            // Extract the splat expression using position-based source extraction
            size_t hash_splat_length = hash_splat->base.location.end - hash_splat->base.location.start;
            char* hash_splat_content = calloc(hash_splat_length + 1, sizeof(char));
            if (hash_splat_content) {
              memcpy(hash_splat_content, (const char*) hash_splat->base.location.start, hash_splat_length);

              position_T* hash_splat_pos = position_init(1, 1);

              // Create RubyLiteralNode with prefix information embedded in content
              char* prefixed_content = calloc(strlen(prefix) + 1 + strlen(hash_splat_content) + 1, sizeof(char));

              if (prefixed_content) {
                snprintf(
                  prefixed_content,
                  strlen(prefix) + 1 + strlen(hash_splat_content) + 1,
                  "%s:%s",
                  prefix,
                  hash_splat_content
                );

                AST_RUBY_LITERAL_NODE_T* hash_splat_ruby_node =
                  ast_ruby_literal_node_init(prefixed_content, hash_splat_pos, hash_splat_pos, array_init(8));

                if (hash_splat_ruby_node) { array_append(attributes, (AST_NODE_T*) hash_splat_ruby_node); }

                free(prefixed_content);
              }

              free(hash_splat_content);
              position_free(hash_splat_pos);
            }
          } else if (hash_element->type == PM_ASSOC_NODE) {
            pm_assoc_node_t* hash_assoc = (pm_assoc_node_t*) hash_element;

            char* attr_key_str = NULL;

            // Extract attribute key (can be symbol or string)
            if (hash_assoc->key->type == PM_SYMBOL_NODE) {
              pm_symbol_node_t* attr_symbol = (pm_symbol_node_t*) hash_assoc->key;
              size_t attr_key_length = pm_string_length(&attr_symbol->unescaped);
              char* raw_key = calloc(attr_key_length + 1, sizeof(char));
              memcpy(raw_key, pm_string_source(&attr_symbol->unescaped), attr_key_length);

              attr_key_str = calloc(prefix_len + 1 + attr_key_length + 1, sizeof(char));
              snprintf(attr_key_str, prefix_len + 1 + attr_key_length + 1, "%s-%s", prefix, raw_key);

              free(raw_key);
            } else if (hash_assoc->key->type == PM_STRING_NODE) {
              pm_string_node_t* attr_string = (pm_string_node_t*) hash_assoc->key;
              size_t attr_key_length = pm_string_length(&attr_string->unescaped);
              char* raw_key = calloc(attr_key_length + 1, sizeof(char));

              memcpy(raw_key, pm_string_source(&attr_string->unescaped), attr_key_length);

              attr_key_str = calloc(prefix_len + 1 + attr_key_length + 1, sizeof(char));
              snprintf(attr_key_str, prefix_len + 1 + attr_key_length + 1, "%s-%s", prefix, raw_key);

              free(raw_key);
            }

            if (attr_key_str) {
              position_T* attr_pos = position_init(1, 1);
              AST_HTML_ATTRIBUTE_NODE_T* attr_attr = NULL;

              if (hash_assoc->value->type == PM_STRING_NODE) {
                pm_string_node_t* attr_string = (pm_string_node_t*) hash_assoc->value;
                size_t attr_value_length = pm_string_length(&attr_string->unescaped);
                char* attr_value_str = calloc(attr_value_length + 1, sizeof(char));
                if (attr_value_str) {
                  memcpy(attr_value_str, pm_string_source(&attr_string->unescaped), attr_value_length);
                  attr_attr = create_html_attribute_node(attr_key_str, attr_value_str, attr_pos, attr_pos);
                  free(attr_value_str);
                }
              } else if (hash_assoc->value->type == PM_INTERPOLATED_STRING_NODE) {
                // Handle interpolated strings by breaking them into LiteralNode and RubyLiteralNode
                // pieces
                pm_interpolated_string_node_t* interpolated = (pm_interpolated_string_node_t*) hash_assoc->value;
                attr_attr =
                  create_html_attribute_with_interpolated_value(attr_key_str, interpolated, attr_pos, attr_pos);
              } else {
                // Handle complex attribute values as Ruby literals
                size_t attr_value_length = hash_assoc->value->location.end - hash_assoc->value->location.start;
                char* ruby_content = calloc(attr_value_length + 1, sizeof(char));
                if (ruby_content) {
                  memcpy(ruby_content, (const char*) hash_assoc->value->location.start, attr_value_length);
                  attr_attr = create_html_attribute_with_ruby_literal(attr_key_str, ruby_content, attr_pos, attr_pos);
                  free(ruby_content);
                }
              }

              if (attr_attr) { array_append(attributes, attr_attr); }
              free(attr_key_str);
              position_free(attr_pos);
            }
          }
        }
      } else {
        // Regular attribute handling
        AST_HTML_ATTRIBUTE_NODE_T* attr =
          extract_html_attribute_from_assoc(assoc, source, original_source, erb_content_offset);

        if (attr) { array_append(attributes, attr); }
      }

      if (key_str) { free(key_str); }
    }
  }

  return attributes;
}

// Check if a call node has keyword arguments that could be HTML attributes
bool has_html_attributes_in_call(pm_call_node_t* call_node) {
  if (!call_node || !call_node->arguments) { return false; }

  pm_arguments_node_t* args = call_node->arguments;
  if (args->arguments.size == 0) { return false; }

  // Check if the last argument is a keyword hash
  pm_node_t* last_arg = args->arguments.nodes[args->arguments.size - 1];

  return last_arg && last_arg->type == PM_KEYWORD_HASH_NODE;
}

// Extract HTML attributes from the last argument of a call node if it's a keyword hash
array_T* extract_html_attributes_from_call_node(
  pm_call_node_t* call_node, const uint8_t* source, const char* original_source, size_t erb_content_offset
) {
  if (!has_html_attributes_in_call(call_node)) { return NULL; }

  pm_arguments_node_t* args = call_node->arguments;
  pm_node_t* last_arg = args->arguments.nodes[args->arguments.size - 1];

  return extract_html_attributes_from_keyword_hash(
    (pm_keyword_hash_node_t*) last_arg,
    source,
    original_source,
    erb_content_offset
  );
}
