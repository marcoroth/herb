#ifndef HERB_ANALYZED_RUBY_H
#define HERB_ANALYZED_RUBY_H

#include "util/hb_array.h"
#include "util/hb_string.h"

#include <prism.h>

typedef struct ANALYZED_RUBY_STRUCT {
  pm_parser_t parser;
  pm_node_t* root;
  bool valid;
  bool parsed;
  bool has_if_node;
  bool has_elsif_node;
  bool has_else_node;
  bool has_end;
  bool has_block_closing;
  bool has_block_node;
  bool has_case_node;
  bool has_case_match_node;
  bool has_when_node;
  bool has_in_node;
  bool has_for_node;
  bool has_while_node;
  bool has_until_node;
  bool has_begin_node;
  bool has_rescue_node;
  bool has_ensure_node;
  bool has_unless_node;
  bool has_yield_node;
} analyzed_ruby_T;

analyzed_ruby_T* init_analyzed_ruby(hb_string_T source);
void free_analyzed_ruby(analyzed_ruby_T* analyzed);

#endif
