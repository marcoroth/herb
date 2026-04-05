#include "../include/analyze/analyze.h"
#include "../include/ast/ast_node.h"
#include "../include/ast/ast_nodes.h"
#include "../include/errors.h"
#include "../include/extract.h"
#include "../include/lib/hb_allocator.h"
#include "../include/lib/hb_string.h"
#include "../include/lib/string.h"
#include "../include/prism/prism_helpers.h"

#include <prism.h>
#include <stdlib.h>
#include <string.h>

static bool document_has_anonymous_keyword_rest(AST_DOCUMENT_NODE_T* document) {
  if (!document || !document->children) { return false; }

  for (size_t index = 0; index < hb_array_size(document->children); index++) {
    AST_NODE_T* child = hb_array_get(document->children, index);
    if (!child || child->type != AST_ERB_STRICT_LOCALS_NODE) { continue; }

    AST_ERB_STRICT_LOCALS_NODE_T* strict_locals_node = (AST_ERB_STRICT_LOCALS_NODE_T*) child;
    if (!strict_locals_node->locals) { continue; }

    for (size_t local_index = 0; local_index < hb_array_size(strict_locals_node->locals); local_index++) {
      AST_RUBY_PARAMETER_NODE_T* local = hb_array_get(strict_locals_node->locals, local_index);
      if (local && string_equals(local->kind.data, "keyword_rest") && local->name == NULL) { return true; }
    }
  }

  return false;
}

static bool should_skip_forwarding_error(
  const pm_diagnostic_t* error,
  bool strict_locals_enabled,
  bool has_anonymous_keyword_rest
) {
  if (error->diag_id != PM_ERR_ARGUMENT_NO_FORWARDING_STAR_STAR) { return false; }

  if (!strict_locals_enabled) { return true; }

  return has_anonymous_keyword_rest;
}

static void parse_erb_content_errors(AST_NODE_T* erb_node, const char* source, hb_allocator_T* allocator) {
  if (!erb_node || erb_node->type != AST_ERB_CONTENT_NODE) { return; }
  AST_ERB_CONTENT_NODE_T* content_node = (AST_ERB_CONTENT_NODE_T*) erb_node;

  if (!content_node->content || hb_string_is_empty(content_node->content->value)) { return; }

  char* content = hb_string_to_c_string_using_malloc(content_node->content->value);
  if (!content) { return; }

  pm_parser_t parser;
  pm_options_t options = { 0, .partial_script = true };
  pm_parser_init(&parser, (const uint8_t*) content, strlen(content), &options);

  pm_node_t* root = pm_parse(&parser);

  const pm_diagnostic_t* error = (const pm_diagnostic_t*) parser.error_list.head;

  if (error != NULL) {
    RUBY_PARSE_ERROR_T* parse_error = ruby_parse_error_from_prism_error_with_positions(
      error,
      erb_node->location.start,
      erb_node->location.end,
      allocator
    );

    hb_array_append(erb_node->errors, parse_error);
  }

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);
  pm_options_free(&options);
  free(content);
}

void herb_analyze_parse_errors(
  AST_DOCUMENT_NODE_T* document,
  const char* source,
  const parser_options_T* parser_options,
  hb_allocator_T* allocator
) {
  char* extracted_ruby = herb_extract_ruby_with_semicolons(source, allocator);

  if (!extracted_ruby) { return; }

  bool strict_locals_enabled = parser_options && parser_options->strict_locals;
  bool has_anonymous_keyword_rest = strict_locals_enabled && document_has_anonymous_keyword_rest(document);

  pm_parser_t parser;
  pm_options_t options = { 0, .partial_script = true };
  pm_parser_init(&parser, (const uint8_t*) extracted_ruby, strlen(extracted_ruby), &options);

  pm_node_t* root = pm_parse(&parser);

  for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) parser.error_list.head; error != NULL;
       error = (const pm_diagnostic_t*) error->node.next) {
    if (should_skip_forwarding_error(error, strict_locals_enabled, has_anonymous_keyword_rest)) { continue; }

    size_t error_offset = (size_t) (error->location.start - parser.start);

    if (strstr(error->message, "unexpected ';'") != NULL) {
      if (error_offset < strlen(extracted_ruby) && extracted_ruby[error_offset] == ';') {
        if (error_offset >= strlen(source) || source[error_offset] != ';') {
          AST_NODE_T* erb_node = find_erb_content_at_offset(document, source, error_offset);

          if (erb_node) { parse_erb_content_errors(erb_node, source, allocator); }

          continue;
        }
      }
    }

    RUBY_PARSE_ERROR_T* parse_error =
      ruby_parse_error_from_prism_error(error, (AST_NODE_T*) document, source, &parser, allocator);
    hb_array_append(document->base.errors, parse_error);
  }

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);
  pm_options_free(&options);
  hb_allocator_dealloc(allocator, extracted_ruby);
}
