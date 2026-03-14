#include "../../include/analyze/action_view/attribute_extraction_helpers.h"
#include "../../include/analyze/action_view/tag_helper_node_builders.h"
#include "../../include/html_util.h"
#include "../../include/util.h"
#include "../../include/util/hb_allocator.h"
#include "../../include/util/hb_array.h"
#include "../../include/util/hb_string.h"

#include <prism.h>
#include <stdlib.h>
#include <string.h>

static char* extract_string_from_prism_node(pm_node_t* node, hb_allocator_T* allocator) {
  const uint8_t* source = NULL;
  size_t length = 0;

  if (node->type == PM_SYMBOL_NODE) {
    pm_symbol_node_t* symbol = (pm_symbol_node_t*) node;
    source = pm_string_source(&symbol->unescaped);
    length = pm_string_length(&symbol->unescaped);
  } else if (node->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) node;
    source = pm_string_source(&string_node->unescaped);
    length = pm_string_length(&string_node->unescaped);
  } else {
    return NULL;
  }

  return hb_allocator_strndup(allocator, (const char*) source, length);
}

static char* build_prefixed_key(const char* prefix, const char* raw_key, hb_allocator_T* allocator) {
  char* dashed_key = convert_underscores_to_dashes(raw_key);
  const char* key = dashed_key ? dashed_key : raw_key;
  size_t prefix_len = strlen(prefix);
  size_t key_len = strlen(key);
  size_t total = prefix_len + 1 + key_len + 1;
  char* result = hb_allocator_alloc(allocator, total);

  if (result) { snprintf(result, total, "%s-%s", prefix, key); }
  if (dashed_key) { free(dashed_key); }

  return result;
}

static AST_HTML_ATTRIBUTE_NODE_T* create_attribute_from_value(
  const char* name_string,
  pm_node_t* value_node,
  position_T start_position,
  position_T end_position,
  hb_allocator_T* allocator
) {
  if (value_node->type == PM_SYMBOL_NODE || value_node->type == PM_STRING_NODE) {
    char* value_string = extract_string_from_prism_node(value_node, allocator);
    if (!value_string) { return NULL; }

    AST_HTML_ATTRIBUTE_NODE_T* attribute =
      create_html_attribute_node(name_string, value_string, start_position, end_position, allocator);
    hb_allocator_dealloc(allocator, value_string);

    return attribute;
  } else if (value_node->type == PM_TRUE_NODE) {
    if (is_boolean_attribute(hb_string((char*) name_string))) {
      return create_html_attribute_node(name_string, NULL, start_position, end_position, allocator);
    }
    return create_html_attribute_node(name_string, "true", start_position, end_position, allocator);
  } else if (value_node->type == PM_FALSE_NODE) {
    if (is_boolean_attribute(hb_string((char*) name_string))) { return NULL; }
    return create_html_attribute_node(name_string, "false", start_position, end_position, allocator);
  } else if (value_node->type == PM_INTERPOLATED_STRING_NODE) {
    return create_html_attribute_with_interpolated_value(
      name_string,
      (pm_interpolated_string_node_t*) value_node,
      start_position,
      end_position,
      allocator
    );
  } else {
    size_t value_length = value_node->location.end - value_node->location.start;
    char* ruby_content = hb_allocator_strndup(allocator, (const char*) value_node->location.start, value_length);

    if (ruby_content && value_node->location.start) {
      AST_HTML_ATTRIBUTE_NODE_T* attribute =
        create_html_attribute_with_ruby_literal(name_string, ruby_content, start_position, end_position, allocator);
      hb_allocator_dealloc(allocator, ruby_content);
      return attribute;
    }

    return NULL;
  }
}

AST_HTML_ATTRIBUTE_NODE_T* extract_html_attribute_from_assoc(
  pm_assoc_node_t* assoc,
  const uint8_t* source,
  const char* original_source,
  size_t erb_content_offset,
  hb_allocator_T* allocator
) {
  if (!assoc) { return NULL; }

  char* name_string = extract_string_from_prism_node(assoc->key, allocator);
  if (!name_string) { return NULL; }

  position_T start_position =
    prism_location_to_position_with_offset(&assoc->key->location, original_source, erb_content_offset, source);
  position_T end_position =
    prism_location_to_position_with_offset(&assoc->value->location, original_source, erb_content_offset, source);

  // Rails converts `method:` and `remote:` to `data-*` attributes
  if (strcmp(name_string, "method") == 0 || strcmp(name_string, "remote") == 0) {
    size_t name_len = strlen(name_string);
    size_t prefixed_len = 5 + name_len + 1;
    char* prefixed = hb_allocator_alloc(allocator, prefixed_len);
    snprintf(prefixed, prefixed_len, "data-%s", name_string);
    hb_allocator_dealloc(allocator, name_string);
    name_string = prefixed;
  }

  if ((strcmp(name_string, "data") == 0 || strcmp(name_string, "aria") == 0) && assoc->value->type == PM_HASH_NODE) {
    hb_allocator_dealloc(allocator, name_string);
    return NULL;
  }

  char* dashed_name = convert_underscores_to_dashes(name_string);
  AST_HTML_ATTRIBUTE_NODE_T* attribute_node = create_attribute_from_value(
    dashed_name ? dashed_name : name_string,
    assoc->value,
    start_position,
    end_position,
    allocator
  );

  if (dashed_name) { free(dashed_name); }
  hb_allocator_dealloc(allocator, name_string);

  return attribute_node;
}

hb_array_T* extract_html_attributes_from_keyword_hash(
  pm_keyword_hash_node_t* kw_hash,
  const uint8_t* source,
  const char* original_source,
  size_t erb_content_offset,
  hb_allocator_T* allocator
) {
  if (!kw_hash) { return NULL; }

  hb_array_T* attributes = hb_array_init(8, allocator);
  if (!attributes) { return NULL; }

  for (size_t i = 0; i < kw_hash->elements.size; i++) {
    pm_node_t* element = kw_hash->elements.nodes[i];

    if (element->type == PM_ASSOC_SPLAT_NODE) {
      pm_assoc_splat_node_t* splat = (pm_assoc_splat_node_t*) element;
      size_t splat_length = splat->base.location.end - splat->base.location.start;
      char* splat_content = hb_allocator_strndup(allocator, (const char*) splat->base.location.start, splat_length);

      if (splat_content) {
        position_T splat_start =
          prism_location_to_position_with_offset(&splat->base.location, original_source, erb_content_offset, source);

        AST_RUBY_HTML_ATTRIBUTES_SPLAT_NODE_T* splat_node = ast_ruby_html_attributes_splat_node_init(
          hb_string_from_c_string(splat_content),
          HB_STRING_EMPTY,
          splat_start,
          splat_start,
          hb_array_init(0, allocator),
          allocator
        );

        if (splat_node) { hb_array_append(attributes, (AST_NODE_T*) splat_node); }

        hb_allocator_dealloc(allocator, splat_content);
      }
    } else if (element->type == PM_ASSOC_NODE) {
      pm_assoc_node_t* assoc = (pm_assoc_node_t*) element;

      char* key_string = extract_string_from_prism_node(assoc->key, allocator);

      if (key_string && (strcmp(key_string, "data") == 0 || strcmp(key_string, "aria") == 0)
          && assoc->value->type == PM_HASH_NODE) {
        pm_hash_node_t* hash = (pm_hash_node_t*) assoc->value;

        for (size_t j = 0; j < hash->elements.size; j++) {
          pm_node_t* hash_element = hash->elements.nodes[j];

          if (hash_element->type == PM_ASSOC_SPLAT_NODE) {
            pm_assoc_splat_node_t* splat = (pm_assoc_splat_node_t*) hash_element;
            size_t splat_length = splat->base.location.end - splat->base.location.start;
            char* splat_content =
              hb_allocator_strndup(allocator, (const char*) splat->base.location.start, splat_length);

            if (splat_content) {
              position_T splat_start = prism_location_to_position_with_offset(
                &splat->base.location,
                original_source,
                erb_content_offset,
                source
              );

              AST_RUBY_HTML_ATTRIBUTES_SPLAT_NODE_T* splat_node = ast_ruby_html_attributes_splat_node_init(
                hb_string_from_c_string(splat_content),
                hb_string_from_c_string(key_string),
                splat_start,
                splat_start,
                hb_array_init(0, allocator),
                allocator
              );

              if (splat_node) { hb_array_append(attributes, (AST_NODE_T*) splat_node); }

              hb_allocator_dealloc(allocator, splat_content);
            }

            continue;
          }

          if (hash_element->type != PM_ASSOC_NODE) { continue; }

          pm_assoc_node_t* hash_assoc = (pm_assoc_node_t*) hash_element;
          char* raw_key = extract_string_from_prism_node(hash_assoc->key, allocator);
          if (!raw_key) { continue; }

          char* attribute_key_string = build_prefixed_key(key_string, raw_key, allocator);
          hb_allocator_dealloc(allocator, raw_key);

          if (attribute_key_string) {
            position_T attribute_start = prism_location_to_position_with_offset(
              &hash_assoc->key->location,
              original_source,
              erb_content_offset,
              source
            );
            position_T attribute_end = prism_location_to_position_with_offset(
              &hash_assoc->value->location,
              original_source,
              erb_content_offset,
              source
            );

            AST_HTML_ATTRIBUTE_NODE_T* attribute = create_attribute_from_value(
              attribute_key_string,
              hash_assoc->value,
              attribute_start,
              attribute_end,
              allocator
            );

            if (attribute) { hb_array_append(attributes, attribute); }
            hb_allocator_dealloc(allocator, attribute_key_string);
          }
        }
      } else {
        AST_HTML_ATTRIBUTE_NODE_T* attribute =
          extract_html_attribute_from_assoc(assoc, source, original_source, erb_content_offset, allocator);

        if (attribute) { hb_array_append(attributes, attribute); }
      }

      if (key_string) { hb_allocator_dealloc(allocator, key_string); }
    }
  }

  return attributes;
}

bool has_html_attributes_in_call(pm_call_node_t* call_node) {
  if (!call_node || !call_node->arguments) { return false; }

  pm_arguments_node_t* arguments = call_node->arguments;
  if (arguments->arguments.size == 0) { return false; }

  pm_node_t* last_argument = arguments->arguments.nodes[arguments->arguments.size - 1];

  return last_argument && last_argument->type == PM_KEYWORD_HASH_NODE;
}

hb_array_T* extract_html_attributes_from_call_node(
  pm_call_node_t* call_node,
  const uint8_t* source,
  const char* original_source,
  size_t erb_content_offset,
  hb_allocator_T* allocator
) {
  if (!has_html_attributes_in_call(call_node)) { return NULL; }

  pm_arguments_node_t* arguments = call_node->arguments;
  pm_node_t* last_argument = arguments->arguments.nodes[arguments->arguments.size - 1];

  return extract_html_attributes_from_keyword_hash(
    (pm_keyword_hash_node_t*) last_argument,
    source,
    original_source,
    erb_content_offset,
    allocator
  );
}
