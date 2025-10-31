#include "include/prism_helpers.h"
#include "include/ast_nodes.h"
#include "include/errors.h"
#include "include/position.h"
#include "include/util.h"

#include <prism.h>

const char* pm_error_level_to_string(pm_error_level_t level) {
  switch (level) {
    case PM_ERROR_LEVEL_SYNTAX: return "syntax";
    case PM_ERROR_LEVEL_ARGUMENT: return "argument";
    case PM_ERROR_LEVEL_LOAD: return "load";

    default: return "Unknown pm_error_level_t";
  }
}

position_T position_from_source_with_offset(const char* source, size_t offset) {
  position_T position = { .line = 1, .column = 0 };

  for (size_t i = 0; i < offset; i++) {
    if (is_newline(source[i])) {
      position.line++;
      position.column = 0;
    } else {
      position.column++;
    }
  }

  return position;
}

RUBY_PARSE_ERROR_T* ruby_parse_error_from_prism_error(
  const pm_diagnostic_t* error,
  const AST_NODE_T* node,
  const char* source,
  pm_parser_t* parser
) {
  size_t start_offset = (size_t) (error->location.start - parser->start);
  size_t end_offset = (size_t) (error->location.end - parser->start);

  position_T start = position_from_source_with_offset(source, start_offset);
  position_T end = position_from_source_with_offset(source, end_offset);

  return ruby_parse_error_init(
    error->message,
    pm_diagnostic_id_human(error->diag_id),
    pm_error_level_to_string(error->level),
    start,
    end,
    NULL
  );
}
