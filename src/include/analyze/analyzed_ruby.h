#ifndef HERB_ANALYZED_RUBY_H
#define HERB_ANALYZED_RUBY_H

#include "../lib/hb_array.h"
#include "../lib/hb_string.h"

#include <prism.h>
#include <stdbool.h>

typedef enum {
  CONTROL_TYPE_IF,
  CONTROL_TYPE_ELSIF,
  CONTROL_TYPE_ELSE,
  CONTROL_TYPE_END,
  CONTROL_TYPE_CASE,
  CONTROL_TYPE_CASE_MATCH,
  CONTROL_TYPE_WHEN,
  CONTROL_TYPE_IN,
  CONTROL_TYPE_BEGIN,
  CONTROL_TYPE_RESCUE,
  CONTROL_TYPE_ENSURE,
  CONTROL_TYPE_UNLESS,
  CONTROL_TYPE_WHILE,
  CONTROL_TYPE_UNTIL,
  CONTROL_TYPE_FOR,
  CONTROL_TYPE_BLOCK,
  CONTROL_TYPE_BLOCK_CLOSE,
  CONTROL_TYPE_YIELD,
  CONTROL_TYPE_UNKNOWN
} control_type_t;

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
  control_type_t control_type;
  bool control_type_detected;
} analyzed_ruby_T;

analyzed_ruby_T* init_analyzed_ruby(hb_string_T source);
void free_analyzed_ruby(analyzed_ruby_T* analyzed);
hb_string_T erb_keyword_from_analyzed_ruby(const analyzed_ruby_T* analyzed);

#endif
