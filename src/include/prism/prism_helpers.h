#ifndef HERB_PRISM_HELPERS_H
#define HERB_PRISM_HELPERS_H

#include "../analyze/analyzed_ruby.h"
#include "../ast/ast_nodes.h"
#include "../errors.h"
#include "../lib/hb_allocator.h"
#include "../location/location.h"
#include "../location/position.h"

#include <prism.h>

static inline bool herb_prism_location_present(pm_location_t location) {
  return location.length > 0;
}

static inline bool herb_prism_location_assigned(pm_location_t location) {
  return location.start != 0 || location.length != 0;
}

static inline uint32_t herb_prism_location_end(pm_location_t location) {
  return location.start + location.length;
}

static inline const uint8_t* herb_prism_location_start_pointer(const uint8_t* base, pm_location_t location) {
  return base + location.start;
}

static inline const uint8_t* herb_prism_location_end_pointer(const uint8_t* base, pm_location_t location) {
  return base + location.start + location.length;
}

hb_string_T pm_error_level_to_string(pm_error_level_t level);

RUBY_PARSE_ERROR_T* ruby_parse_error_from_prism_error(
  const pm_diagnostic_t* error,
  const AST_NODE_T* node,
  const char* source,
  pm_parser_t* parser,
  hb_allocator_T* allocator
);

RUBY_PARSE_ERROR_T* ruby_parse_error_from_prism_error_with_positions(
  const pm_diagnostic_t* error,
  position_T start,
  position_T end,
  hb_allocator_T* allocator
);

location_T* get_then_keyword_location(analyzed_ruby_T* analyzed, const char* source, hb_allocator_T* allocator);
location_T* get_then_keyword_location_wrapped(const char* source, bool is_in_clause, hb_allocator_T* allocator);
location_T* get_then_keyword_location_elsif_wrapped(const char* source, hb_allocator_T* allocator);

#endif
