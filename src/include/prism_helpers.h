#ifndef HERB_PRISM_HELPERS_H
#define HERB_PRISM_HELPERS_H

#include "ast_nodes.h"
#include "errors.h"
#include "position.h"

#include <prism.h>

const char* pm_error_level_to_string(pm_error_level_t level);

RUBY_PARSE_ERROR_T* ruby_parse_error_from_prism_error(
  const pm_diagnostic_t* error,
  const AST_NODE_T* node,
  const char* source,
  pm_parser_t* parser
);

RUBY_PARSE_ERROR_T* ruby_parse_error_from_prism_error_with_positions(
  const pm_diagnostic_t* error,
  position_T start,
  position_T end
);

#endif
