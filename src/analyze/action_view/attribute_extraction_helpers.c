#include "../../include/analyze/action_view/attribute_extraction_helpers.h"
#include "../../include/analyze/action_view/tag_helper_node_builders.h"
#include "../../include/lib/hb_allocator.h"
#include "../../include/lib/hb_array.h"
#include "../../include/lib/hb_buffer.h"
#include "../../include/lib/hb_string.h"
#include "../../include/util/html_util.h"
#include "../../include/util/util.h"

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

static void compute_position_pair(
  const pm_location_t* location,
  const uint8_t* source,
  const char* original_source,
  size_t erb_content_offset,
  position_T* out_start,
  position_T* out_end
) {
  *out_start = prism_location_to_position_with_offset(location, original_source, erb_content_offset, source);
  pm_location_t end_location = { .start = location->end, .end = location->end };
  *out_end = prism_location_to_position_with_offset(&end_location, original_source, erb_content_offset, source);
}

static void extract_key_name_location(pm_node_t* key, pm_location_t* out_name_loc) {
  if (key->type == PM_SYMBOL_NODE) {
    pm_symbol_node_t* symbol = (pm_symbol_node_t*) key;
    *out_name_loc = symbol->value_loc;
  } else if (key->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) key;
    *out_name_loc = string_node->content_loc;
  } else {
    *out_name_loc = key->location;
  }
}

static void compute_separator_info(
  pm_assoc_node_t* assoc,
  const uint8_t* source,
  const char* original_source,
  size_t erb_content_offset,
  position_T key_end,
  const char** out_separator_string,
  token_type_T* out_separator_type,
  position_T* out_separator_start,
  position_T* out_separator_end
) {
  *out_separator_end =
    prism_location_to_position_with_offset(&assoc->value->location, original_source, erb_content_offset, source);

  if (assoc->operator_loc.start != NULL) {
    *out_separator_string = " => ";
    *out_separator_type = TOKEN_EQUALS;
    *out_separator_start = key_end;
  } else {
    *out_separator_string = ": ";
    *out_separator_type = TOKEN_COLON;

    pm_location_t colon_loc = {
      .start = assoc->key->location.end - 1,
      .end = assoc->key->location.end - 1,
    };

    *out_separator_start =
      prism_location_to_position_with_offset(&colon_loc, original_source, erb_content_offset, source);
  }
}

static void extract_delimited_locations(
  pm_node_t* node,
  const pm_location_t** out_opening,
  const pm_location_t** out_closing,
  const pm_location_t** out_content
) {
  if (node->type == PM_STRING_NODE) {
    pm_string_node_t* string_node = (pm_string_node_t*) node;
    *out_opening = &string_node->opening_loc;
    *out_closing = &string_node->closing_loc;
    *out_content = &string_node->content_loc;
  } else if (node->type == PM_SYMBOL_NODE) {
    pm_symbol_node_t* symbol_node = (pm_symbol_node_t*) node;
    *out_opening = &symbol_node->opening_loc;
    *out_closing = &symbol_node->closing_loc;
    *out_content = &symbol_node->value_loc;
  } else {
    *out_opening = NULL;
    *out_closing = NULL;
    *out_content = NULL;
  }
}

static void compute_value_positions(
  pm_node_t* value_node,
  const uint8_t* source,
  const char* original_source,
  size_t erb_content_offset,
  position_T* out_value_start,
  position_T* out_value_end,
  position_T* out_content_start,
  position_T* out_content_end,
  bool* out_quoted
) {
  const pm_location_t* opening_loc;
  const pm_location_t* closing_loc;
  const pm_location_t* content_loc;

  extract_delimited_locations(value_node, &opening_loc, &closing_loc, &content_loc);

  if (opening_loc && opening_loc->start != NULL && closing_loc && closing_loc->start != NULL) {
    compute_position_pair(
      &*opening_loc,
      source,
      original_source,
      erb_content_offset,
      out_value_start,
      out_content_start
    );

    compute_position_pair(&*closing_loc, source, original_source, erb_content_offset, out_content_end, out_value_end);
    *out_quoted = true;
  } else {
    const pm_location_t* fallback_loc = content_loc ? content_loc : &value_node->location;
    compute_position_pair(fallback_loc, source, original_source, erb_content_offset, out_value_start, out_value_end);
    *out_content_start = *out_value_start;
    *out_content_end = *out_value_end;
    *out_quoted = false;
  }
}

static void fill_attribute_positions(
  pm_assoc_node_t* assoc,
  const uint8_t* source,
  const char* original_source,
  size_t erb_content_offset,
  attribute_positions_T* positions
) {
  pm_location_t name_loc;
  extract_key_name_location(assoc->key, &name_loc);
  compute_position_pair(
    &name_loc,
    source,
    original_source,
    erb_content_offset,
    &positions->name_start,
    &positions->name_end
  );

  position_T key_end;
  pm_location_t key_end_loc = { .start = assoc->key->location.end, .end = assoc->key->location.end };
  key_end = prism_location_to_position_with_offset(&key_end_loc, original_source, erb_content_offset, source);

  compute_separator_info(
    assoc,
    source,
    original_source,
    erb_content_offset,
    key_end,
    &positions->separator_string,
    &positions->separator_type,
    &positions->separator_start,
    &positions->separator_end
  );

  compute_value_positions(
    assoc->value,
    source,
    original_source,
    erb_content_offset,
    &positions->value_start,
    &positions->value_end,
    &positions->content_start,
    &positions->content_end,
    &positions->quoted
  );
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

static bool is_static_string_array(pm_array_node_t* array) {
  if (!array || array->elements.size == 0) { return false; }

  for (size_t i = 0; i < array->elements.size; i++) {
    pm_node_t* element = array->elements.nodes[i];

    if (element->type != PM_STRING_NODE && element->type != PM_SYMBOL_NODE) { return false; }
  }

  return true;
}

static char* join_static_string_array(pm_array_node_t* array, hb_allocator_T* allocator) {
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 64, allocator);

  for (size_t i = 0; i < array->elements.size; i++) {
    if (i > 0) { hb_buffer_append(&buffer, " "); }

    char* value = extract_string_from_prism_node(array->elements.nodes[i], allocator);

    if (value) {
      hb_buffer_append(&buffer, value);
      hb_allocator_dealloc(allocator, value);
    }
  }

  char* result = hb_allocator_strdup(allocator, hb_buffer_value(&buffer));

  return result;
}

static AST_HTML_ATTRIBUTE_NODE_T* create_attribute_from_value(
  const char* name_string,
  pm_node_t* value_node,
  attribute_positions_T* positions,
  hb_allocator_T* allocator,
  bool is_nested
) {
  if (value_node->type == PM_ARRAY_NODE && !is_nested && is_static_string_array((pm_array_node_t*) value_node)) {
    char* joined = join_static_string_array((pm_array_node_t*) value_node, allocator);
    if (!joined) { return NULL; }

    AST_HTML_ATTRIBUTE_NODE_T* attribute =
      create_html_attribute_node_precise(name_string, joined, positions, allocator);
    hb_allocator_dealloc(allocator, joined);

    return attribute;
  }

  if (value_node->type == PM_SYMBOL_NODE || value_node->type == PM_STRING_NODE) {
    char* value_string = extract_string_from_prism_node(value_node, allocator);
    if (!value_string) { return NULL; }

    AST_HTML_ATTRIBUTE_NODE_T* attribute =
      create_html_attribute_node_precise(name_string, value_string, positions, allocator);
    hb_allocator_dealloc(allocator, value_string);

    return attribute;
  } else if (value_node->type == PM_TRUE_NODE) {
    if (is_boolean_attribute(hb_string((char*) name_string))) {
      return create_html_attribute_node_precise(name_string, NULL, positions, allocator);
    }

    return create_html_attribute_node_precise(name_string, "true", positions, allocator);
  } else if (value_node->type == PM_FALSE_NODE) {
    if (is_boolean_attribute(hb_string((char*) name_string))) { return NULL; }

    return create_html_attribute_node_precise(name_string, "false", positions, allocator);
  } else if (value_node->type == PM_INTEGER_NODE) {
    size_t value_length = value_node->location.end - value_node->location.start;
    char* value_string = hb_allocator_strndup(allocator, (const char*) value_node->location.start, value_length);
    if (!value_string) { return NULL; }

    AST_HTML_ATTRIBUTE_NODE_T* attribute =
      create_html_attribute_node_precise(name_string, value_string, positions, allocator);
    hb_allocator_dealloc(allocator, value_string);

    return attribute;
  } else if (value_node->type == PM_INTERPOLATED_STRING_NODE) {
    return create_html_attribute_with_interpolated_value(
      name_string,
      (pm_interpolated_string_node_t*) value_node,
      positions->name_start,
      positions->value_end,
      allocator
    );
  } else {
    size_t value_length = value_node->location.end - value_node->location.start;
    char* raw_content = hb_allocator_strndup(allocator, (const char*) value_node->location.start, value_length);

    if (raw_content && value_node->location.start) {
      char* ruby_content = raw_content;

      if (!is_nested && strcmp(name_string, "class") == 0
          && (value_node->type == PM_HASH_NODE || value_node->type == PM_ARRAY_NODE)) {
        hb_buffer_T class_buffer;
        hb_buffer_init(&class_buffer, value_length + 16, allocator);
        hb_buffer_append(&class_buffer, "token_list(");
        hb_buffer_append(&class_buffer, raw_content);
        hb_buffer_append(&class_buffer, ")");

        ruby_content = hb_buffer_value(&class_buffer);
      }

      // Rails calls .to_json on non-string/symbol values inside data:/aria: hashes
      if (is_nested) {
        hb_buffer_T json_buffer;
        hb_buffer_init(&json_buffer, value_length + 16, allocator);
        hb_buffer_append(&json_buffer, raw_content);
        hb_buffer_append(&json_buffer, ".to_json");

        ruby_content = hb_buffer_value(&json_buffer);
      }

      AST_HTML_ATTRIBUTE_NODE_T* attribute =
        create_html_attribute_with_ruby_literal_precise(name_string, ruby_content, positions, allocator);
      hb_allocator_dealloc(allocator, raw_content);

      return attribute;
    }

    return NULL;
  }
}

static const char* get_attribute_name_string(AST_HTML_ATTRIBUTE_NODE_T* attribute) {
  if (!attribute || !attribute->name || !attribute->name->children) { return NULL; }
  if (hb_array_size(attribute->name->children) == 0) { return NULL; }

  AST_NODE_T* first_child = (AST_NODE_T*) hb_array_get(attribute->name->children, 0);
  if (!first_child || first_child->type != AST_LITERAL_NODE) { return NULL; }

  AST_LITERAL_NODE_T* literal = (AST_LITERAL_NODE_T*) first_child;
  return (const char*) literal->content.data;
}

void resolve_nonce_attribute(hb_array_T* attributes, hb_allocator_T* allocator) {
  if (!attributes) { return; }

  for (size_t index = 0; index < hb_array_size(attributes); index++) {
    AST_NODE_T* node = hb_array_get(attributes, index);
    if (!node || node->type != AST_HTML_ATTRIBUTE_NODE) { continue; }

    AST_HTML_ATTRIBUTE_NODE_T* attribute = (AST_HTML_ATTRIBUTE_NODE_T*) node;
    const char* name = get_attribute_name_string(attribute);
    if (!name || strcmp(name, "nonce") != 0) { continue; }

    if (!attribute->value || !attribute->value->children) { continue; }
    if (hb_array_size(attribute->value->children) == 0) { continue; }

    AST_NODE_T* value_child = (AST_NODE_T*) hb_array_get(attribute->value->children, 0);
    if (!value_child || value_child->type != AST_LITERAL_NODE) { continue; }

    AST_LITERAL_NODE_T* literal = (AST_LITERAL_NODE_T*) value_child;

    if (hb_string_equals(literal->content, hb_string("true"))) {
      AST_RUBY_LITERAL_NODE_T* ruby_node = ast_ruby_literal_node_init(
        hb_string_from_c_string("content_security_policy_nonce"),
        attribute->value->base.location.start,
        attribute->value->base.location.end,
        hb_array_init(0, allocator),
        allocator
      );

      hb_array_T* new_children = hb_array_init(1, allocator);
      hb_array_append(new_children, (AST_NODE_T*) ruby_node);
      attribute->value->children = new_children;
      return;
    }

    if (hb_string_equals(literal->content, hb_string("false"))) {
      hb_array_remove(attributes, index);
      return;
    }
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

  if (strcmp(name_string, "escape") == 0) {
    hb_allocator_dealloc(allocator, name_string);
    return NULL;
  }

  if (!assoc->value) {
    hb_allocator_dealloc(allocator, name_string);
    return NULL;
  }

  if (assoc->value->type == PM_IMPLICIT_NODE) {
    pm_location_t name_loc;
    extract_key_name_location(assoc->key, &name_loc);
    position_T name_start, name_end;
    compute_position_pair(&name_loc, source, original_source, erb_content_offset, &name_start, &name_end);

    char* dashed_name = convert_underscores_to_dashes(name_string);

    AST_HTML_ATTRIBUTE_NODE_T* attribute = create_html_attribute_with_ruby_literal(
      dashed_name ? dashed_name : name_string,
      name_string,
      name_start,
      name_start,
      allocator
    );

    if (dashed_name) { free(dashed_name); }
    hb_allocator_dealloc(allocator, name_string);

    return attribute;
  }

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

  attribute_positions_T positions;
  fill_attribute_positions(assoc, source, original_source, erb_content_offset, &positions);

  char* dashed_name = convert_underscores_to_dashes(name_string);
  AST_HTML_ATTRIBUTE_NODE_T* attribute_node =
    create_attribute_from_value(dashed_name ? dashed_name : name_string, assoc->value, &positions, allocator, false);

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

      if (splat->value) {
        size_t value_length = splat->value->location.end - splat->value->location.start;
        char* value_source = hb_allocator_strndup(allocator, (const char*) splat->value->location.start, value_length);

        if (value_source) {
          hb_buffer_T wrapped;
          hb_buffer_init(&wrapped, value_length + 32, allocator);
          hb_buffer_append(&wrapped, "tag.attributes(**");
          hb_buffer_append(&wrapped, value_source);
          hb_buffer_append(&wrapped, ")");

          position_T splat_start =
            prism_location_to_position_with_offset(&splat->base.location, original_source, erb_content_offset, source);

          AST_RUBY_HTML_ATTRIBUTES_SPLAT_NODE_T* splat_node = ast_ruby_html_attributes_splat_node_init(
            hb_string_from_c_string(hb_buffer_value(&wrapped)),
            HB_STRING_EMPTY,
            splat_start,
            splat_start,
            hb_array_init(0, allocator),
            allocator
          );

          if (splat_node) { hb_array_append(attributes, (AST_NODE_T*) splat_node); }

          hb_buffer_free(&wrapped);
          hb_allocator_dealloc(allocator, value_source);
        }
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

            if (splat->value) {
              size_t value_length = splat->value->location.end - splat->value->location.start;
              char* value_source =
                hb_allocator_strndup(allocator, (const char*) splat->value->location.start, value_length);

              if (value_source) {
                hb_buffer_T wrapped;
                hb_buffer_init(&wrapped, value_length + 48, allocator);
                hb_buffer_append(&wrapped, "tag.attributes(");
                hb_buffer_append(&wrapped, key_string);
                hb_buffer_append(&wrapped, ": ");
                hb_buffer_append(&wrapped, value_source);
                hb_buffer_append(&wrapped, ")");

                position_T splat_start = prism_location_to_position_with_offset(
                  &splat->base.location,
                  original_source,
                  erb_content_offset,
                  source
                );

                AST_RUBY_HTML_ATTRIBUTES_SPLAT_NODE_T* splat_node = ast_ruby_html_attributes_splat_node_init(
                  hb_string_from_c_string(hb_buffer_value(&wrapped)),
                  hb_string_from_c_string(key_string),
                  splat_start,
                  splat_start,
                  hb_array_init(0, allocator),
                  allocator
                );

                if (splat_node) { hb_array_append(attributes, (AST_NODE_T*) splat_node); }

                hb_buffer_free(&wrapped);
                hb_allocator_dealloc(allocator, value_source);
              }
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
            attribute_positions_T hash_positions;
            fill_attribute_positions(hash_assoc, source, original_source, erb_content_offset, &hash_positions);

            AST_HTML_ATTRIBUTE_NODE_T* attribute =
              create_attribute_from_value(attribute_key_string, hash_assoc->value, &hash_positions, allocator, true);

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

  return last_argument && (last_argument->type == PM_KEYWORD_HASH_NODE || last_argument->type == PM_HASH_NODE);
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

  if (last_argument->type == PM_HASH_NODE) {
    pm_hash_node_t* hash_node = (pm_hash_node_t*) last_argument;
    pm_keyword_hash_node_t synthetic = { .base = hash_node->base, .elements = hash_node->elements };

    return extract_html_attributes_from_keyword_hash(
      &synthetic,
      source,
      original_source,
      erb_content_offset,
      allocator
    );
  }

  return extract_html_attributes_from_keyword_hash(
    (pm_keyword_hash_node_t*) last_argument,
    source,
    original_source,
    erb_content_offset,
    allocator
  );
}
