#include "include/analyze.h"
#include "include/analyze_control_flow.h"
#include "include/analyze_helpers.h"
#include "include/analyze_tag_helpers.h"
#include "include/analyzed_ruby.h"
#include "include/array.h"
#include "include/ast_nodes.h"
#include "include/errors.h"
#include "include/extract.h"
#include "include/location.h"
#include "include/position.h"
#include "include/pretty_print.h"
#include "include/prism_helpers.h"
#include "include/tag_helper_handler.h"
#include "include/token_struct.h"
#include "include/util.h"
#include "include/visitor.h"

#include <prism.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

size_t calculate_byte_offset_from_position(const char* source, position_T* position) {
  if (!source || !position) { return 0; }

  size_t current_line = 1;
  size_t current_column = 0;
  size_t byte_offset = 0;

  while (source[byte_offset] != '\0') {
    if (current_line == position->line && current_column == position->column) { return byte_offset; }

    if (source[byte_offset] == '\n') {
      current_line++;
      current_column = 0;
    } else {
      current_column++;
    }

    byte_offset++;
  }

  return byte_offset;
}

static analyzed_ruby_T* herb_analyze_ruby(char* source) {
  analyzed_ruby_T* analyzed = init_analyzed_ruby(source);

  pm_visit_node(analyzed->root, search_if_nodes, analyzed);
  pm_visit_node(analyzed->root, search_block_nodes, analyzed);
  pm_visit_node(analyzed->root, search_case_nodes, analyzed);
  pm_visit_node(analyzed->root, search_case_match_nodes, analyzed);
  pm_visit_node(analyzed->root, search_while_nodes, analyzed);
  pm_visit_node(analyzed->root, search_for_nodes, analyzed);
  pm_visit_node(analyzed->root, search_until_nodes, analyzed);
  pm_visit_node(analyzed->root, search_begin_nodes, analyzed);
  pm_visit_node(analyzed->root, search_unless_nodes, analyzed);

  search_elsif_nodes(analyzed);
  search_else_nodes(analyzed);
  search_end_nodes(analyzed);
  search_when_nodes(analyzed);
  search_in_nodes(analyzed);
  search_rescue_nodes(analyzed);
  search_ensure_nodes(analyzed);
  search_yield_nodes(analyzed);
  search_block_closing_nodes(analyzed);

  return analyzed;
}

static bool analyze_erb_content(const AST_NODE_T* node, void* data) {
  if (node->type == AST_ERB_CONTENT_NODE) {
    AST_ERB_CONTENT_NODE_T* erb_content_node = (AST_ERB_CONTENT_NODE_T*) node;

    analyzed_ruby_T* analyzed = herb_analyze_ruby(erb_content_node->content->value);

    if (false) { pretty_print_analyed_ruby(analyzed, erb_content_node->content->value); }

    erb_content_node->parsed = true;
    erb_content_node->valid = analyzed->valid;
    erb_content_node->analyzed_ruby = analyzed;
  }

  herb_visit_child_nodes(node, analyze_erb_content, data);

  return false;
}

static array_T* transform_tag_helper_blocks(array_T* array, analyze_ruby_context_T* context) {
  array_T* new_array = array_init(array_size(array));

  for (size_t i = 0; i < array_size(array); i++) {
    AST_NODE_T* item = array_get(array, i);

    if (!item) {
      array_append(new_array, item);
      continue;
    }

    if (item->type == AST_ERB_BLOCK_NODE) {
      AST_ERB_BLOCK_NODE_T* block_node = (AST_ERB_BLOCK_NODE_T*) item;

      if (has_tag_helper_block(block_node)) {
        AST_NODE_T* transformed = transform_erb_block_to_tag_helper(block_node, context);
        if (transformed) {
          array_append(new_array, transformed);
          continue;
        }
      }
    } else if (item->type == AST_ERB_CONTENT_NODE) {
      AST_ERB_CONTENT_NODE_T* content_node = (AST_ERB_CONTENT_NODE_T*) item;

      if (is_tag_helper_block(content_node->content->value, content_node)) {
        AST_NODE_T* transformed = NULL;

        // Determine tag helper type and call appropriate transformation
        pm_parser_t parser;
        const uint8_t* source = (const uint8_t*) content_node->content->value;
        pm_parser_init(&parser, source, strlen(content_node->content->value), NULL);

        pm_node_t* root = pm_parse(&parser);
        if (root) {
          tag_helper_info_T* info = tag_helper_info_init();
          tag_helper_search_data_T search_data = { .tag_helper_node = NULL,
                                                   .source = source,
                                                   .parser = &parser,
                                                   .info = info,
                                                   .matched_handler = NULL,
                                                   .found = false };

          pm_visit_node(root, search_tag_helper_node, &search_data);

          if (search_data.found && search_data.matched_handler && strcmp(search_data.matched_handler->name, "link_to") == 0) {
            transformed = transform_link_to_helper(content_node, context);
          } else if (has_tag_helper_attributes(content_node->content->value)) {
            transformed = transform_tag_helper_with_attributes(content_node, context);
          } else {
            transformed = transform_simple_tag_helper(content_node, context);
          }

          tag_helper_info_free(&info);
          pm_node_destroy(&parser, root);
        }

        pm_parser_free(&parser);

        if (transformed) {
          array_append(new_array, transformed);
          continue;
        }
      }
    }

    array_append(new_array, item);
  }

  return new_array;
}

static bool transform_erb_nodes(const AST_NODE_T* node, void* data) {
  analyze_ruby_context_T* context = (analyze_ruby_context_T*) data;
  context->parent = (AST_NODE_T*) node;

  if (node->type == AST_DOCUMENT_NODE) {
    AST_DOCUMENT_NODE_T* document_node = (AST_DOCUMENT_NODE_T*) node;
    array_T* old_array = document_node->children;

    document_node->children = rewrite_node_array((AST_NODE_T*) node, document_node->children, context);

    array_T* intermediate_array = document_node->children;
    document_node->children = transform_tag_helper_blocks(intermediate_array, context);
    array_free(&intermediate_array);

    array_free(&old_array);
  }

  if (node->type == AST_HTML_ELEMENT_NODE) {
    AST_HTML_ELEMENT_NODE_T* element_node = (AST_HTML_ELEMENT_NODE_T*) node;
    array_T* old_array = element_node->body;

    element_node->body = rewrite_node_array((AST_NODE_T*) node, element_node->body, context);

    array_T* intermediate_array = element_node->body;
    element_node->body = transform_tag_helper_blocks(intermediate_array, context);
    array_free(&intermediate_array);

    array_free(&old_array);
  }

  if (node->type == AST_HTML_OPEN_TAG_NODE) {
    AST_HTML_OPEN_TAG_NODE_T* open_tag = (AST_HTML_OPEN_TAG_NODE_T*) node;
    array_T* old_array = open_tag->children;

    open_tag->children = rewrite_node_array((AST_NODE_T*) node, open_tag->children, context);

    array_T* intermediate_array = open_tag->children;
    open_tag->children = transform_tag_helper_blocks(intermediate_array, context);
    array_free(&intermediate_array);

    array_free(&old_array);
  }

  if (node->type == AST_HTML_ATTRIBUTE_VALUE_NODE) {
    AST_HTML_ATTRIBUTE_VALUE_NODE_T* attr_value = (AST_HTML_ATTRIBUTE_VALUE_NODE_T*) node;
    array_T* old_array = attr_value->children;

    attr_value->children = rewrite_node_array((AST_NODE_T*) node, attr_value->children, context);

    array_T* intermediate_array = attr_value->children;
    attr_value->children = transform_tag_helper_blocks(intermediate_array, context);
    array_free(&intermediate_array);

    array_free(&old_array);
  }

  herb_visit_child_nodes(node, transform_erb_nodes, data);

  return false;
}

void herb_analyze_parse_tree(AST_DOCUMENT_NODE_T* document, const char* source) {
  herb_visit_node((AST_NODE_T*) document, analyze_erb_content, NULL);

  analyze_ruby_context_T* context = malloc(sizeof(analyze_ruby_context_T));
  context->document = document;
  context->parent = NULL;
  context->ruby_context_stack = array_init(8);

  herb_visit_node((AST_NODE_T*) document, transform_erb_nodes, context);

  herb_analyze_parse_errors(document, source);

  array_free(&context->ruby_context_stack);
  free(context);
}

void herb_analyze_parse_errors(AST_DOCUMENT_NODE_T* document, const char* source) {
  char* extracted_ruby = herb_extract_ruby_with_semicolons(source);

  pm_parser_t parser;
  pm_parser_init(&parser, (const uint8_t*) extracted_ruby, strlen(extracted_ruby), NULL);

  pm_node_t* root = pm_parse(&parser);

  for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) parser.error_list.head; error != NULL;
       error = (const pm_diagnostic_t*) error->node.next) {

    RUBY_PARSE_ERROR_T* parse_error = ruby_parse_error_from_prism_error(error, (AST_NODE_T*) document, source, &parser);

    // TODO: ideally this shouldn't be hard-coded
    if (strcmp(parse_error->diagnostic_id, "invalid_yield") == 0) {
      error_free((ERROR_T*) parse_error);
    } else {
      array_append(document->base.errors, parse_error);
    }
  }

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);
  free(extracted_ruby);
}
