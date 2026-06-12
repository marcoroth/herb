#ifndef HERB_PARSER_H
#define HERB_PARSER_H

#include "../ast/ast_node.h"
#include "../lexer/lexer.h"
#include "../lib/hb_allocator.h"
#include "../lib/hb_array.h"
#include "../lib/hb_clock.h"

#include <stdint.h>

typedef enum {
  FOREIGN_CONTENT_UNKNOWN = 0,
  FOREIGN_CONTENT_SCRIPT,
  FOREIGN_CONTENT_STYLE,
  // FOREIGN_CONTENT_RUBY,
  // FOREIGN_CONTENT_TEMPLATE
} foreign_content_type_T;

typedef enum { PARSER_STATE_DATA, PARSER_STATE_FOREIGN_CONTENT } parser_state_T;

typedef struct PARSER_OPTIONS_STRUCT {
  bool track_whitespace;
  bool analyze;
  bool strict;
  bool action_view_helpers;
  bool transform_conditionals;
  bool render_nodes;
  bool strict_locals;
  bool prism_program;
  bool prism_nodes;
  bool prism_nodes_deep;
  bool dot_notation_tags;
  bool html;
  uint32_t start_line;
  uint32_t start_column;
  uint32_t timeout_ms;
  uint32_t max_errors;
  uint32_t* error_count;
  uint64_t deadline_ms;
} parser_options_T;

typedef struct MATCH_TAGS_CONTEXT_STRUCT {
  hb_array_T* errors;
  const parser_options_T* options;
  hb_allocator_T* allocator;
} match_tags_context_T;

extern const parser_options_T HERB_DEFAULT_PARSER_OPTIONS;

static inline bool parser_options_past_deadline(const parser_options_T* options) {
  if (options == NULL || options->timeout_ms == 0) { return false; }

  return hb_monotonic_ms() >= options->deadline_ms;
}

static inline bool parser_options_errors_exceeded(const parser_options_T* options) {
  if (options == NULL || options->error_count == NULL) { return false; }
  if (options->max_errors == 0) { return false; }

  return *options->error_count >= options->max_errors;
}

static inline void parser_options_increment_error_count(const parser_options_T* options) {
  if (options != NULL && options->error_count != NULL) { (*options->error_count)++; }
}

static inline void parser_options_set_deadline(parser_options_T* options) {
  if (options->timeout_ms == 0) { return; }

  options->deadline_ms = hb_monotonic_ms() + options->timeout_ms;
}

typedef struct PARSER_STRUCT {
  hb_allocator_T* allocator;
  lexer_T* lexer;
  token_T* current_token;
  hb_array_T* open_tags_stack;
  parser_state_T state;
  foreign_content_type_T foreign_content_type;
  parser_options_T options;
  size_t consecutive_error_count;
  bool in_recovery_mode;
} parser_T;

size_t parser_sizeof(void);

void herb_parser_init(parser_T* parser, lexer_T* lexer, parser_options_T options);

AST_DOCUMENT_NODE_T* herb_parser_parse(parser_T* parser);

void herb_parser_match_html_tags_post_analyze(
  AST_DOCUMENT_NODE_T* document,
  const parser_options_T* options,
  hb_allocator_T* allocator
);
void herb_parser_deinit(parser_T* parser);

void match_tags_in_node_array(
  hb_array_T* nodes,
  hb_array_T* errors,
  const parser_options_T* options,
  hb_allocator_T* allocator
);
bool match_tags_visitor(const AST_NODE_T* node, void* data);

#endif
