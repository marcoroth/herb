#ifndef HERB_PRETTY_PRINT_H
#define HERB_PRETTY_PRINT_H

#include "analyze/analyzed_ruby.h"
#include "ast_nodes.h"
#include "location.h"
#include "util/hb_buffer.h"

#include <stdbool.h>

void pretty_print_indent(hb_buffer_T* buffer, size_t indent);
void pretty_print_newline(size_t indent, size_t relative_indent, hb_buffer_T* buffer);
void pretty_print_label(
  hb_string_T name,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  hb_buffer_T* buffer
);

void pretty_print_position_property(
  position_T* position,
  hb_string_T name,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  hb_buffer_T* buffer
);

void pretty_print_location(location_T location, hb_buffer_T* buffer);

void pretty_print_property(
  hb_string_T name,
  hb_string_T value,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  hb_buffer_T* buffer
);

void pretty_print_size_t_property(
  size_t value,
  hb_string_T name,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  hb_buffer_T* buffer
);

void pretty_print_string_property(
  hb_string_T string,
  hb_string_T name,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  hb_buffer_T* buffer
);

void pretty_print_quoted_property(
  hb_string_T name,
  hb_string_T value,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  hb_buffer_T* buffer
);

void pretty_print_boolean_property(
  hb_string_T name,
  bool value,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  hb_buffer_T* buffer
);

void pretty_print_token_property(
  token_T* token,
  hb_string_T name,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  hb_buffer_T* buffer
);

void pretty_print_array(
  hb_string_T name,
  hb_array_T* array,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  hb_buffer_T* buffer
);

void pretty_print_errors(
  AST_NODE_T* node,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  hb_buffer_T* buffer
);

#endif
