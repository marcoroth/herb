#include "../include/analyze/analyze.h"
#include "../include/ast/ast_node.h"
#include "../include/ast/ast_nodes.h"
#include "../include/errors.h"
#include "../include/extract.h"
#include "../include/lib/hb_allocator.h"
#include "../include/lib/hb_string.h"
#include "../include/prism/prism_helpers.h"

#include <prism.h>
#include <stdlib.h>
#include <string.h>

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

void herb_analyze_parse_errors(AST_DOCUMENT_NODE_T* document, const char* source, hb_allocator_T* allocator) {
  char* extracted_ruby = herb_extract_ruby_with_semicolons(source, allocator);

  if (!extracted_ruby) { return; }

  pm_parser_t parser;
  pm_options_t options = { 0, .partial_script = true };
  pm_parser_init(&parser, (const uint8_t*) extracted_ruby, strlen(extracted_ruby), &options);

  pm_node_t* root = pm_parse(&parser);

  for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) parser.error_list.head; error != NULL;
       error = (const pm_diagnostic_t*) error->node.next) {
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
