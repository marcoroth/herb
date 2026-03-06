#include "../include/analyze/analyzed_ruby.h"
#include "../include/util/hb_string.h"

#include <prism.h>
#include <string.h>

analyzed_ruby_T* init_analyzed_ruby(hb_string_T source) {
  analyzed_ruby_T* analyzed = malloc(sizeof(analyzed_ruby_T));

  if (!analyzed) { return NULL; }

  pm_parser_init(&analyzed->parser, (const uint8_t*) source.data, source.length, NULL);

  analyzed->root = pm_parse(&analyzed->parser);
  analyzed->valid = (analyzed->parser.error_list.size == 0);
  analyzed->parsed = true;
  analyzed->if_node_count = 0;
  analyzed->elsif_node_count = 0;
  analyzed->else_node_count = 0;
  analyzed->end_count = 0;
  analyzed->block_node_count = 0;
  analyzed->block_closing_count = 0;
  analyzed->case_node_count = 0;
  analyzed->case_match_node_count = 0;
  analyzed->when_node_count = 0;
  analyzed->in_node_count = 0;
  analyzed->for_node_count = 0;
  analyzed->while_node_count = 0;
  analyzed->until_node_count = 0;
  analyzed->begin_node_count = 0;
  analyzed->rescue_node_count = 0;
  analyzed->ensure_node_count = 0;
  analyzed->unless_node_count = 0;
  analyzed->yield_node_count = 0;
  analyzed->then_keyword_count = 0;
  analyzed->unclosed_control_flow_count = 0;

  return analyzed;
}

void free_analyzed_ruby(analyzed_ruby_T* analyzed) {
  if (!analyzed) { return; }

  if (analyzed->parsed && analyzed->root != NULL) { pm_node_destroy(&analyzed->parser, analyzed->root); }

  pm_parser_free(&analyzed->parser);

  free(analyzed);
}

const char* erb_keyword_from_analyzed_ruby(const analyzed_ruby_T* analyzed) {
  if (analyzed->end_count > 0) {
    return "`<% end %>`";
  } else if (analyzed->else_node_count > 0) {
    return "`<% else %>`";
  } else if (analyzed->elsif_node_count > 0) {
    return "`<% elsif %>`";
  } else if (analyzed->when_node_count > 0) {
    return "`<% when %>`";
  } else if (analyzed->in_node_count > 0) {
    return "`<% in %>`";
  } else if (analyzed->rescue_node_count > 0) {
    return "`<% rescue %>`";
  } else if (analyzed->ensure_node_count > 0) {
    return "`<% ensure %>`";
  }

  return NULL;
}
