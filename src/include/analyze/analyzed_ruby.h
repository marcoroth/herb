#ifndef HERB_ANALYZED_RUBY_H
#define HERB_ANALYZED_RUBY_H

#include "../util/hb_array.h"
#include "../util/hb_string.h"

#include <prism.h>

typedef struct ANALYZED_RUBY_STRUCT {
  pm_parser_t parser;
  pm_node_t* root;
  bool valid;
  bool parsed;
  int if_node_count;
  int elsif_node_count;
  int else_node_count;
  int end_count;
  int block_closing_count;
  int block_node_count;
  int case_node_count;
  int case_match_node_count;
  int when_node_count;
  int in_node_count;
  int for_node_count;
  int while_node_count;
  int until_node_count;
  int begin_node_count;
  int rescue_node_count;
  int ensure_node_count;
  int unless_node_count;
  int yield_node_count;
  int then_keyword_count;
  int unclosed_control_flow_count;
} analyzed_ruby_T;

analyzed_ruby_T* init_analyzed_ruby(hb_string_T source);
void free_analyzed_ruby(analyzed_ruby_T* analyzed);
const char* erb_keyword_from_analyzed_ruby(const analyzed_ruby_T* analyzed);

#endif
