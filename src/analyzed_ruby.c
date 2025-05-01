#include "include/analyzed_ruby.h"

#include <prism.h>
#include <string.h>

analyzed_ruby_T* init_analyzed_ruby(char* source) {
  analyzed_ruby_T* analyzed = malloc(sizeof(analyzed_ruby_T));

  pm_parser_init(&analyzed->parser, (const uint8_t*) source, strlen(source), NULL);

  analyzed->root = pm_parse(&analyzed->parser);
  analyzed->valid = (analyzed->parser.error_list.size == 0);
  analyzed->parsed = true;
  analyzed->has_if_node = false;
  analyzed->has_elsif_node = false;
  analyzed->has_else_node = false;
  analyzed->has_end = false;
  analyzed->has_block_node = false;
  analyzed->has_block_closing = false;
  analyzed->has_case_node = false;
  analyzed->has_when_node = false;
  analyzed->has_for_node = false;
  analyzed->has_while_node = false;
  analyzed->has_until_node = false;
  analyzed->has_begin_node = false;
  analyzed->has_rescue_node = false;
  analyzed->has_ensure_node = false;
  analyzed->has_unless_node = false;
  analyzed->has_yield_node = false;

  return analyzed;
}

void free_analyzed_ruby(analyzed_ruby_T* analyzed) {
  // TODO
}
