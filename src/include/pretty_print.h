#ifndef HERB_PRETTY_PRINT_H
#define HERB_PRETTY_PRINT_H

#include "analyzed_ruby.h"
#include "ast_nodes.h"
#include "buffer.h"
#include "location.h"

#include <stdbool.h>

void pretty_print_indent(buffer_T* buffer, size_t indent);
void pretty_print_newline(size_t indent, size_t relative_indent, buffer_T* buffer);
void pretty_print_label(const char* name, size_t indent, size_t relative_indent, bool last_property, buffer_T* buffer);

void pretty_print_position_property(
  position_T* position,
  const char* name,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  buffer_T* buffer
);

void pretty_print_location(location_T* location, buffer_T* buffer);

void pretty_print_property(
  const char* name,
  const char* value,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  buffer_T* buffer
);

void pretty_print_size_t_property(
  size_t value,
  const char* name,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  buffer_T* buffer
);

void pretty_print_string_property(
  const char* string,
  const char* name,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  buffer_T* buffer
);

void pretty_print_quoted_property(
  const char* name,
  const char* value,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  buffer_T* buffer
);

void pretty_print_boolean_property(
  const char* name,
  bool value,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  buffer_T* buffer
);

void pretty_print_token_property(
  token_T* token,
  const char* name,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  buffer_T* buffer
);

void pretty_print_array(
  const char* name,
  array_T* array,
  size_t indent,
  size_t relative_indent,
  bool last_property,
  buffer_T* buffer
);

void pretty_print_errors(AST_NODE_T* node, size_t indent, size_t relative_indent, bool last_property, buffer_T* buffer);

void pretty_print_analyed_ruby(analyzed_ruby_T* analyzed, const char* source);

#endif
