#ifndef HERB_EXTENSION_HERB_H
#define HERB_EXTENSION_HERB_H

#include <ruby.h>

#include <stdbool.h>

#include "../../src/include/herb.h"
#include "../../src/include/lexer/token.h"
#include "../../src/include/location/location.h"
#include "../../src/include/location/position.h"
#include "../../src/include/location/range.h"

// When false, Herb's Ruby AST is built without Location/Range/Position objects
// (they are left nil). Set per-parse by Herb_parse from the `track_locations`
// option. Only affects Ruby object materialization, not the native parse.
extern bool herb_ext_track_locations;

// Total number of errors materialized onto AST nodes during the current parse.
// Accumulated by rb_errors_array_from_c_array as the tree is built and read by
// Herb_parse to record a total on the ParseResult, letting Ruby skip the full
// recursive error walk when a template parsed cleanly.
extern uint32_t herb_ext_error_count;

const char* check_string(VALUE value);
VALUE rb_string_from_hb_string(hb_string_T string);
VALUE rb_interned_string_from_hb_string(hb_string_T string);

VALUE rb_position_from_c_struct(position_T position);
VALUE rb_location_from_c_struct(location_T location);

VALUE rb_token_from_c_struct(token_T* token);
VALUE rb_range_from_c_struct(range_T range);

VALUE create_lex_result(hb_array_T* tokens, VALUE source);
VALUE create_parse_result(AST_DOCUMENT_NODE_T* root, VALUE source, const parser_options_T* options);

#endif
