#include "../../include/analyze/action_view/tag_helper_node_builders.h"
#include "../../include/ast/ast_nodes.h"
#include "../../include/lexer/token_struct.h"
#include "../../include/lib/hb_allocator.h"
#include "../../include/lib/hb_array.h"
#include "../../include/lib/hb_string.h"
#include "../../include/location/location.h"
#include "../../include/location/position.h"
#include "../../include/location/range.h"

#include <prism.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

token_T* create_synthetic_token(
  hb_allocator_T* allocator,
  const char* value,
  token_type_T type,
  position_T start,
  position_T end
) {
  token_T* token = hb_allocator_alloc(allocator, sizeof(token_T));
  if (!token) { return NULL; }

  if (value) {
    size_t length = strlen(value);
    char* copied = hb_allocator_strndup(allocator, value, length);
    token->value = hb_string_from_data(copied, length);
  } else {
    token->value = HB_STRING_EMPTY;
  }

  token->type = type;
  location_from_positions(&token->location, start, end);
  token->range = (range_T) { .from = 0, .to = 0 };

  return token;
}

AST_HTML_ATTRIBUTE_NAME_NODE_T* create_attribute_name_node(
  const char* name_string,
  position_T start_position,
  position_T end_position,
  hb_allocator_T* allocator
) {
  AST_LITERAL_NODE_T* name_literal = ast_literal_node_init(
    hb_string_from_c_string(name_string),
    start_position,
    end_position,
    hb_array_init(0, allocator),
    allocator
  );

  hb_array_T* name_children = hb_array_init(1, allocator);
  hb_array_append(name_children, (AST_NODE_T*) name_literal);

  return ast_html_attribute_name_node_init(
    name_children,
    start_position,
    end_position,
    hb_array_init(0, allocator),
    allocator
  );
}

hb_array_T* prepend_attribute(hb_array_T* attributes, AST_NODE_T* attribute, hb_allocator_T* allocator) {
  hb_array_T* new_attributes = hb_array_init(hb_array_size(attributes) + 1, allocator);
  hb_array_append(new_attributes, attribute);

  for (size_t i = 0; i < hb_array_size(attributes); i++) {
    hb_array_append(new_attributes, hb_array_get(attributes, i));
  }

  hb_array_free(&attributes);
  return new_attributes;
}

AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_node(
  const char* name_string,
  const char* value_string,
  position_T start_position,
  position_T end_position,
  hb_allocator_T* allocator
) {
  if (!name_string) { return NULL; }

  AST_HTML_ATTRIBUTE_NAME_NODE_T* name_node =
    create_attribute_name_node(name_string, start_position, end_position, allocator);

  token_T* equals_token =
    value_string ? create_synthetic_token(allocator, "=", TOKEN_EQUALS, start_position, end_position) : NULL;
  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node = NULL;

  if (value_string) {
    token_T* open_quote = create_synthetic_token(allocator, "\"", TOKEN_QUOTE, start_position, end_position);
    token_T* close_quote = create_synthetic_token(allocator, "\"", TOKEN_QUOTE, end_position, end_position);

    AST_LITERAL_NODE_T* value_literal = ast_literal_node_init(
      hb_string_from_c_string(value_string),
      start_position,
      end_position,
      hb_array_init(0, allocator),
      allocator
    );
    hb_array_T* value_children = hb_array_init(1, allocator);
    hb_array_append(value_children, (AST_NODE_T*) value_literal);

    value_node = ast_html_attribute_value_node_init(
      open_quote,
      value_children,
      close_quote,
      true,
      start_position,
      end_position,
      hb_array_init(0, allocator),
      allocator
    );
  }

  return ast_html_attribute_node_init(
    name_node,
    equals_token,
    value_node,
    start_position,
    end_position,
    hb_array_init(0, allocator),
    allocator
  );
}

AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_with_ruby_literal(
  const char* name_string,
  const char* ruby_content,
  position_T start_position,
  position_T end_position,
  hb_allocator_T* allocator
) {
  if (!name_string || !ruby_content) { return NULL; }

  AST_HTML_ATTRIBUTE_NAME_NODE_T* name_node =
    create_attribute_name_node(name_string, start_position, end_position, allocator);

  token_T* equals_token = create_synthetic_token(allocator, ":", TOKEN_COLON, start_position, end_position);

  AST_RUBY_LITERAL_NODE_T* ruby_node = ast_ruby_literal_node_init(
    hb_string_from_c_string(ruby_content),
    start_position,
    end_position,
    hb_array_init(0, allocator),
    allocator
  );

  hb_array_T* value_children = hb_array_init(1, allocator);
  hb_array_append(value_children, (AST_NODE_T*) ruby_node);

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node = ast_html_attribute_value_node_init(
    NULL,
    value_children,
    NULL,
    false,
    start_position,
    end_position,
    hb_array_init(0, allocator),
    allocator
  );

  return ast_html_attribute_node_init(
    name_node,
    equals_token,
    value_node,
    start_position,
    end_position,
    hb_array_init(0, allocator),
    allocator
  );
}

static AST_HTML_ATTRIBUTE_VALUE_NODE_T* create_interpolated_attribute_value(
  pm_interpolated_string_node_t* interpolated_node,
  position_T start_position,
  position_T end_position,
  hb_allocator_T* allocator
) {
  if (!interpolated_node) { return NULL; }

  hb_array_T* value_children = hb_array_init(8, allocator);

  for (size_t i = 0; i < interpolated_node->parts.size; i++) {
    pm_node_t* part = interpolated_node->parts.nodes[i];

    if (part->type == PM_STRING_NODE) {
      pm_string_node_t* string_part = (pm_string_node_t*) part;
      size_t content_length = pm_string_length(&string_part->unescaped);

      if (content_length > 0) {
        char* content =
          hb_allocator_strndup(allocator, (const char*) pm_string_source(&string_part->unescaped), content_length);
        if (content) {
          AST_LITERAL_NODE_T* literal_node = ast_literal_node_init(
            hb_string_from_c_string(content),
            start_position,
            end_position,
            hb_array_init(0, allocator),
            allocator
          );

          if (literal_node) { hb_array_append(value_children, (AST_NODE_T*) literal_node); }

          hb_allocator_dealloc(allocator, content);
        }
      }
    } else if (part->type == PM_EMBEDDED_STATEMENTS_NODE) {
      pm_embedded_statements_node_t* embedded = (pm_embedded_statements_node_t*) part;
      const uint8_t* content_start;
      const uint8_t* content_end;

      if (embedded->statements) {
        content_start = embedded->statements->base.location.start;
        content_end = embedded->statements->base.location.end;
      } else {
        content_start = part->location.start;
        content_end = part->location.end;
      }

      size_t ruby_length = content_end - content_start;
      char* ruby_content = hb_allocator_strndup(allocator, (const char*) content_start, ruby_length);

      if (ruby_content) {
        AST_RUBY_LITERAL_NODE_T* ruby_node = ast_ruby_literal_node_init(
          hb_string_from_c_string(ruby_content),
          start_position,
          end_position,
          hb_array_init(0, allocator),
          allocator
        );

        if (ruby_node) { hb_array_append(value_children, (AST_NODE_T*) ruby_node); }

        hb_allocator_dealloc(allocator, ruby_content);
      }
    }
  }

  return ast_html_attribute_value_node_init(
    NULL,
    value_children,
    NULL,
    false,
    start_position,
    end_position,
    hb_array_init(0, allocator),
    allocator
  );
}

AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_with_interpolated_value(
  const char* name_string,
  pm_interpolated_string_node_t* interpolated_node,
  position_T start_position,
  position_T end_position,
  hb_allocator_T* allocator
) {
  if (!name_string || !interpolated_node) { return NULL; }

  AST_HTML_ATTRIBUTE_NAME_NODE_T* name_node =
    create_attribute_name_node(name_string, start_position, end_position, allocator);

  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node =
    create_interpolated_attribute_value(interpolated_node, start_position, end_position, allocator);

  token_T* equals_token = create_synthetic_token(allocator, "=", TOKEN_EQUALS, start_position, end_position);

  return ast_html_attribute_node_init(
    name_node,
    equals_token,
    value_node,
    start_position,
    end_position,
    hb_array_init(0, allocator),
    allocator
  );
}

AST_HTML_ATTRIBUTE_NODE_T* create_href_attribute(
  const char* href,
  bool is_ruby_expression,
  position_T start_position,
  position_T end_position,
  hb_allocator_T* allocator
) {
  return is_ruby_expression
         ? create_html_attribute_with_ruby_literal("href", href, start_position, end_position, allocator)
         : create_html_attribute_node("href", href, start_position, end_position, allocator);
}

void append_body_content_node(
  hb_array_T* body,
  const char* content,
  bool is_ruby_expression,
  position_T start,
  position_T end,
  hb_allocator_T* allocator
) {
  if (!content || !body) { return; }

  if (is_ruby_expression) {
    AST_RUBY_LITERAL_NODE_T* ruby_node =
      ast_ruby_literal_node_init(hb_string_from_c_string(content), start, end, hb_array_init(0, allocator), allocator);

    if (ruby_node) { hb_array_append(body, (AST_NODE_T*) ruby_node); }
  } else {
    AST_HTML_TEXT_NODE_T* text_node =
      ast_html_text_node_init(hb_string_from_c_string(content), start, end, hb_array_init(0, allocator), allocator);

    if (text_node) { hb_array_append(body, (AST_NODE_T*) text_node); }
  }
}
