#include "include/pretty_print.h"
#include "include/analyzed_ruby.h"
#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/ast_pretty_print.h"
#include "include/buffer.h"
#include "include/errors.h"
#include "include/token_struct.h"
#include "include/util.h"

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>

void pretty_print_indent(buffer_T* buffer, const size_t indent) {
  for (size_t i = 0; i < indent; i++) {
    buffer_append(buffer, "    ");
  }
}

void pretty_print_newline(const size_t indent, const size_t relative_indent, buffer_T* buffer) {
  pretty_print_indent(buffer, indent);
  pretty_print_indent(buffer, relative_indent);
  buffer_append(buffer, "\n");
}

void pretty_print_label(
  const char* name,
  const size_t indent,
  const size_t relative_indent,
  const bool last_property,
  buffer_T* buffer
) {
  pretty_print_indent(buffer, indent);
  pretty_print_indent(buffer, relative_indent);

  if (last_property) {
    buffer_append(buffer, "└── ");
  } else {
    buffer_append(buffer, "├── ");
  }

  buffer_append(buffer, name);
  buffer_append(buffer, ": ");
}

void pretty_print_quoted_property(
  const char* name,
  const char* value,
  const size_t indent,
  const size_t relative_indent,
  const bool last_property,
  buffer_T* buffer
) {
  char* quoted = quoted_string(value);
  pretty_print_property(name, quoted, indent, relative_indent, last_property, buffer);
  free(quoted);
}

void pretty_print_boolean_property(
  const char* name,
  bool value,
  const size_t indent,
  const size_t relative_indent,
  const bool last_property,
  buffer_T* buffer
) {
  pretty_print_property(name, value ? "true" : "false", indent, relative_indent, last_property, buffer);
}

void pretty_print_property(
  const char* name,
  const char* value,
  const size_t indent,
  const size_t relative_indent,
  const bool last_property,
  buffer_T* buffer
) {
  pretty_print_label(name, indent, relative_indent, last_property, buffer);
  buffer_append(buffer, value);
  buffer_append(buffer, "\n");
}

void pretty_print_size_t_property(
  size_t value,
  const char* name,
  const size_t indent,
  const size_t relative_indent,
  const bool last_property,
  buffer_T* buffer
) {
  pretty_print_label(name, indent, relative_indent, last_property, buffer);
  char* string = size_t_to_string(value);
  buffer_append(buffer, string);
  buffer_append(buffer, "\n");
  free(string);
}

void pretty_print_array(
  const char* name,
  array_T* array,
  const size_t indent,
  const size_t relative_indent,
  const bool last_property,
  buffer_T* buffer
) {
  if (array == NULL) {
    pretty_print_property(name, "∅", indent, relative_indent, last_property, buffer);

    return;
  }

  if (array_size(array) == 0) {
    pretty_print_property(name, "[]", indent, relative_indent, last_property, buffer);

    return;
  }

  pretty_print_label(name, indent, relative_indent, last_property, buffer);

  buffer_append(buffer, "(");

  char count[16];
  sprintf(count, "%zu", array_size(array));
  buffer_append(buffer, count);
  buffer_append(buffer, ")\n");

  if (indent < 20) {
    for (size_t i = 0; i < array_size(array); i++) {
      AST_NODE_T* child = array_get(array, i);
      pretty_print_indent(buffer, indent);
      pretty_print_indent(buffer, relative_indent + 1);

      if (i == array_size(array) - 1) {
        buffer_append(buffer, "└── ");
      } else {
        buffer_append(buffer, "├── ");
      }

      ast_pretty_print_node(child, indent + 1, relative_indent + 1, buffer);

      if (i != array_size(array) - 1) { pretty_print_newline(indent + 1, relative_indent, buffer); }
    }
  }
  buffer_append(buffer, "\n");
}

void pretty_print_errors(
  AST_NODE_T* node,
  const size_t indent,
  const size_t relative_indent,
  const bool last_property,
  buffer_T* buffer
) {
  if (node->errors != NULL && array_size(node->errors) > 0) {
    error_pretty_print_array("errors", node->errors, indent, relative_indent, last_property, buffer);
    buffer_append(buffer, "\n");
  }
}

void pretty_print_location(location_T location, buffer_T* buffer) {
  buffer_append(buffer, "(location: (");
  char location_string[128];
  sprintf(
    location_string,
    "%u,%u)-(%u,%u",
    location.start.line,
    location.start.column,
    location.end.line,
    location.end.column
  );
  buffer_append(buffer, location_string);
  buffer_append(buffer, "))");
}

void pretty_print_position_property(
  position_T* position,
  const char* name,
  const size_t indent,
  const size_t relative_indent,
  const bool last_property,
  buffer_T* buffer
) {
  pretty_print_label(name, indent, relative_indent, last_property, buffer);

  if (position != NULL) {
    buffer_append(buffer, "(");

    char position_string[128];

    sprintf(position_string, "%u:%u", (position->line) ? position->line : 0, (position->column) ? position->column : 0);

    buffer_append(buffer, position_string);
    buffer_append(buffer, ")");
  } else {
    buffer_append(buffer, "∅");
  }

  buffer_append(buffer, "\n");
}

void pretty_print_token_property(
  token_T* token,
  const char* name,
  const size_t indent,
  const size_t relative_indent,
  const bool last_property,
  buffer_T* buffer
) {
  pretty_print_label(name, indent, relative_indent, last_property, buffer);

  if (token != NULL && token->value != NULL) {
    char* quoted = quoted_string(token->value);
    buffer_append(buffer, quoted);
    free(quoted);

    buffer_append(buffer, " ");
    pretty_print_location(token->location, buffer);
  } else {
    buffer_append(buffer, "∅");
  }

  buffer_append(buffer, "\n");
}

void pretty_print_string_property(
  const char* string,
  const char* name,
  const size_t indent,
  const size_t relative_indent,
  const bool last_property,
  buffer_T* buffer
) {
  const char* value = "∅";
  char* escaped = NULL;
  char* quoted = NULL;

  if (string != NULL) {
    escaped = escape_newlines(string);
    quoted = quoted_string(escaped);
    value = quoted;
  }

  pretty_print_property(name, value, indent, relative_indent, last_property, buffer);

  if (string != NULL) {
    if (escaped != NULL) { free(escaped); }
    if (quoted != NULL) { free(quoted); }
  }
}

void pretty_print_analyzed_ruby(analyzed_ruby_T* analyzed, const char* source) {
  printf(
    "------------------------\nanalyzed (%p)\n------------------------\n%s\n------------------------\n  if:     %i\n "
    " elsif:  %i\n  else:   %i\n  end:    %i\n  block:  %i\n  block_closing: %i\n  case:   %i\n  when:   %i\n  for:    "
    "%i\n  while:  %i\n "
    " until:  %i\n  begin:  %i\n  "
    "rescue: %i\n  ensure: %i\n  unless: %i\n==================\n\n",
    (void*) analyzed,
    source,
    analyzed->has_if_node,
    analyzed->has_elsif_node,
    analyzed->has_else_node,
    analyzed->has_end,
    analyzed->has_block_node,
    analyzed->has_block_closing,
    analyzed->has_case_node,
    analyzed->has_when_node,
    analyzed->has_for_node,
    analyzed->has_while_node,
    analyzed->has_until_node,
    analyzed->has_begin_node,
    analyzed->has_rescue_node,
    analyzed->has_ensure_node,
    analyzed->has_unless_node
  );
}
