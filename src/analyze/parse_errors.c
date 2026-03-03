#include "../include/analyze/analyze.h"
#include "../include/ast_node.h"
#include "../include/ast_nodes.h"
#include "../include/errors.h"
#include "../include/extract.h"
#include "../include/prism_helpers.h"

#include <prism.h>
#include <string.h>

static void parse_erb_content_errors(AST_NODE_T* erb_node, const char* source) {
  if (!erb_node || erb_node->type != AST_ERB_CONTENT_NODE) { return; }
  AST_ERB_CONTENT_NODE_T* content_node = (AST_ERB_CONTENT_NODE_T*) erb_node;

  if (!content_node->content || !content_node->content->value) { return; }

  const char* content = content_node->content->value;
  if (strlen(content) == 0) { return; }

  pm_parser_t parser;
  pm_options_t options = { 0, .partial_script = true };
  pm_parser_init(&parser, (const uint8_t*) content, strlen(content), &options);

  pm_node_t* root = pm_parse(&parser);

  const pm_diagnostic_t* error = (const pm_diagnostic_t*) parser.error_list.head;

  if (error != NULL) {
    RUBY_PARSE_ERROR_T* parse_error =
      ruby_parse_error_from_prism_error_with_positions(error, erb_node->location.start, erb_node->location.end);

    hb_array_append(erb_node->errors, parse_error);
  }

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);
  pm_options_free(&options);
}

void herb_analyze_parse_errors(AST_DOCUMENT_NODE_T* document, const char* source) {
  char* extracted_ruby = herb_extract_ruby_with_semicolons(source);

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

          if (erb_node) { parse_erb_content_errors(erb_node, source); }

          continue;
        }
      }
    }

    RUBY_PARSE_ERROR_T* parse_error = ruby_parse_error_from_prism_error(error, (AST_NODE_T*) document, source, &parser);
    hb_array_append(document->base.errors, parse_error);
  }

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);
  pm_options_free(&options);
  free(extracted_ruby);
}
