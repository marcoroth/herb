#ifndef HERB_PRISM_HELPERS_H
#define HERB_PRISM_HELPERS_H

#include "analyze/analyzed_ruby.h"
#include "ast_nodes.h"
#include "errors.h"
#include "location.h"
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

location_T* get_then_keyword_location(analyzed_ruby_T* analyzed, const char* source);
location_T* get_then_keyword_location_wrapped(const char* source, bool is_in_clause);
location_T* get_then_keyword_location_elsif_wrapped(const char* source);

#endif
