#include "../include/analyze/invalid_structures.h"
#include "../include/analyze/analyze.h"
#include "../include/analyze/analyzed_ruby.h"
#include "../include/analyze/helpers.h"
#include "../include/ast_node.h"
#include "../include/ast_nodes.h"
#include "../include/errors.h"
#include "../include/token_struct.h"
#include "../include/util/hb_array.h"
#include "../include/visitor.h"

#include <stdbool.h>
#include <stddef.h>

bool detect_invalid_erb_structures(const AST_NODE_T* node, void* data) {
  invalid_erb_context_T* context = (invalid_erb_context_T*) data;

  if (node->type == AST_HTML_ATTRIBUTE_NAME_NODE) { return false; }

  bool is_begin_node = (node->type == AST_ERB_BEGIN_NODE);
  bool is_loop_node =
    (node->type == AST_ERB_WHILE_NODE || node->type == AST_ERB_UNTIL_NODE || node->type == AST_ERB_FOR_NODE
     || node->type == AST_ERB_BLOCK_NODE);

  if (is_loop_node) { context->loop_depth++; }
  if (is_begin_node) { context->rescue_depth++; }

  if (node->type == AST_ERB_CONTENT_NODE) {
    const AST_ERB_CONTENT_NODE_T* content_node = (const AST_ERB_CONTENT_NODE_T*) node;

    if (content_node->parsed && !content_node->valid && content_node->analyzed_ruby != NULL) {
      analyzed_ruby_T* analyzed = content_node->analyzed_ruby;

      // =begin
      if (has_error_message(analyzed, "embedded document meets end of file")) {
        if (is_loop_node) { context->loop_depth--; }
        if (is_begin_node) { context->rescue_depth--; }

        return true;
      }

      // =end
      if (has_error_message(analyzed, "unexpected '=', ignoring it")
          && has_error_message(analyzed, "unexpected 'end', ignoring it")) {
        if (is_loop_node) { context->loop_depth--; }
        if (is_begin_node) { context->rescue_depth--; }

        return true;
      }

      const char* keyword = NULL;

      if (context->loop_depth == 0) {
        if (has_error_message(analyzed, "Invalid break")) {
          keyword = "`<% break %>`";
        } else if (has_error_message(analyzed, "Invalid next")) {
          keyword = "`<% next %>`";
        } else if (has_error_message(analyzed, "Invalid redo")) {
          keyword = "`<% redo %>`";
        }
      } else {
        if (has_error_message(analyzed, "Invalid redo") || has_error_message(analyzed, "Invalid break")
            || has_error_message(analyzed, "Invalid next")) {

          if (is_loop_node) { context->loop_depth--; }
          if (is_begin_node) { context->rescue_depth--; }

          return true;
        }
      }

      if (context->rescue_depth == 0) {
        if (has_error_message(analyzed, "Invalid retry without rescue")) { keyword = "`<% retry %>`"; }
      } else {
        if (has_error_message(analyzed, "Invalid retry without rescue")) {
          if (is_loop_node) { context->loop_depth--; }
          if (is_begin_node) { context->rescue_depth--; }

          return true;
        }
      }

      if (keyword == NULL) { keyword = erb_keyword_from_analyzed_ruby(analyzed); }

      if (keyword != NULL && !token_value_empty(content_node->tag_closing)) {
        append_erb_control_flow_scope_error(keyword, node->location.start, node->location.end, node->errors);
      }
    }
  }

  if (node->type == AST_ERB_IF_NODE) {
    const AST_ERB_IF_NODE_T* if_node = (const AST_ERB_IF_NODE_T*) node;

    if (if_node->end_node == NULL) { check_erb_node_for_missing_end(node); }

    if (if_node->statements != NULL) {
      for (size_t i = 0; i < hb_array_size(if_node->statements); i++) {
        AST_NODE_T* statement = (AST_NODE_T*) hb_array_get(if_node->statements, i);

        if (statement != NULL) { herb_visit_node(statement, detect_invalid_erb_structures, context); }
      }
    }

    AST_NODE_T* subsequent = if_node->subsequent;

    while (subsequent != NULL) {
      if (subsequent->type == AST_ERB_CONTENT_NODE) {
        const AST_ERB_CONTENT_NODE_T* content_node = (const AST_ERB_CONTENT_NODE_T*) subsequent;

        if (content_node->parsed && !content_node->valid && content_node->analyzed_ruby != NULL) {
          analyzed_ruby_T* analyzed = content_node->analyzed_ruby;
          const char* keyword = erb_keyword_from_analyzed_ruby(analyzed);

          if (!token_value_empty(content_node->tag_closing)) {
            append_erb_control_flow_scope_error(
              keyword,
              subsequent->location.start,
              subsequent->location.end,
              subsequent->errors
            );
          }
        }
      }

      if (subsequent->type == AST_ERB_IF_NODE) {
        const AST_ERB_IF_NODE_T* elsif_node = (const AST_ERB_IF_NODE_T*) subsequent;

        if (elsif_node->statements != NULL) {
          for (size_t i = 0; i < hb_array_size(elsif_node->statements); i++) {
            AST_NODE_T* statement = (AST_NODE_T*) hb_array_get(elsif_node->statements, i);

            if (statement != NULL) { herb_visit_node(statement, detect_invalid_erb_structures, context); }
          }
        }

        subsequent = elsif_node->subsequent;
      } else if (subsequent->type == AST_ERB_ELSE_NODE) {
        const AST_ERB_ELSE_NODE_T* else_node = (const AST_ERB_ELSE_NODE_T*) subsequent;

        if (else_node->statements != NULL) {
          for (size_t i = 0; i < hb_array_size(else_node->statements); i++) {
            AST_NODE_T* statement = (AST_NODE_T*) hb_array_get(else_node->statements, i);

            if (statement != NULL) { herb_visit_node(statement, detect_invalid_erb_structures, context); }
          }
        }

        break;
      } else {
        break;
      }
    }
  }

  if (node->type == AST_ERB_UNLESS_NODE || node->type == AST_ERB_WHILE_NODE || node->type == AST_ERB_UNTIL_NODE
      || node->type == AST_ERB_FOR_NODE || node->type == AST_ERB_CASE_NODE || node->type == AST_ERB_CASE_MATCH_NODE
      || node->type == AST_ERB_BEGIN_NODE || node->type == AST_ERB_BLOCK_NODE || node->type == AST_ERB_ELSE_NODE) {
    herb_visit_child_nodes(node, detect_invalid_erb_structures, context);
  }

  if (node->type == AST_ERB_UNLESS_NODE || node->type == AST_ERB_WHILE_NODE || node->type == AST_ERB_UNTIL_NODE
      || node->type == AST_ERB_FOR_NODE || node->type == AST_ERB_CASE_NODE || node->type == AST_ERB_CASE_MATCH_NODE
      || node->type == AST_ERB_BEGIN_NODE || node->type == AST_ERB_BLOCK_NODE || node->type == AST_ERB_ELSE_NODE) {
    check_erb_node_for_missing_end(node);

    if (is_loop_node) { context->loop_depth--; }
    if (is_begin_node) { context->rescue_depth--; }

    return false;
  }

  if (node->type == AST_ERB_IF_NODE) {
    if (is_loop_node) { context->loop_depth--; }
    if (is_begin_node) { context->rescue_depth--; }

    return false;
  }

  bool result = true;

  if (is_loop_node) { context->loop_depth--; }
  if (is_begin_node) { context->rescue_depth--; }

  return result;
}
