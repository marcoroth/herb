#include "include/analyze.h"
#include "include/analyze_helpers.h"
#include "include/analyzed_ruby.h"
#include "include/array.h"
#include "include/ast_nodes.h"
#include "include/errors.h"
#include "include/extract.h"
#include "include/location.h"
#include "include/position.h"
#include "include/pretty_print.h"
#include "include/prism_helpers.h"
#include "include/token_struct.h"
#include "include/util.h"
#include "include/visitor.h"

#include <prism.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

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
  search_yield_nodes(analyzed->root, analyzed);
  search_block_closing_nodes(analyzed);

  return analyzed;
}

static bool analyze_erb_content(const AST_NODE_T* node, void* data) {
  if (node->type == AST_ERB_CONTENT_NODE) {
    AST_ERB_CONTENT_NODE_T* erb_content_node = (AST_ERB_CONTENT_NODE_T*) node;

    const char* opening = erb_content_node->tag_opening->value;

    if (strcmp(opening, "<%%") != 0 && strcmp(opening, "<%%=") != 0 && strcmp(opening, "<%#") != 0) {
      analyzed_ruby_T* analyzed = herb_analyze_ruby(erb_content_node->content->value);

      if (false) { pretty_print_analyzed_ruby(analyzed, erb_content_node->content->value); }

      erb_content_node->parsed = true;
      erb_content_node->valid = analyzed->valid;
      erb_content_node->analyzed_ruby = analyzed;
    } else {
      erb_content_node->parsed = false;
      erb_content_node->valid = true;
      erb_content_node->analyzed_ruby = NULL;
    }
  }

  herb_visit_child_nodes(node, analyze_erb_content, data);

  return false;
}

static size_t process_block_children(
  AST_NODE_T* node,
  array_T* array,
  size_t index,
  array_T* children_array,
  analyze_ruby_context_T* context,
  control_type_t parent_type
);

static size_t process_subsequent_block(
  AST_NODE_T* node,
  array_T* array,
  size_t index,
  AST_NODE_T** subsequent_out,
  analyze_ruby_context_T* context,
  control_type_t parent_type
);

static control_type_t detect_control_type(AST_ERB_CONTENT_NODE_T* erb_node) {
  if (!erb_node || erb_node->base.type != AST_ERB_CONTENT_NODE) { return CONTROL_TYPE_UNKNOWN; }

  analyzed_ruby_T* ruby = erb_node->analyzed_ruby;

  if (!ruby) { return CONTROL_TYPE_UNKNOWN; }

  if (ruby->valid) {
    if (has_yield_node(ruby)) { return CONTROL_TYPE_YIELD; }
    return CONTROL_TYPE_UNKNOWN;
  }

  if (has_yield_node(ruby)) { return CONTROL_TYPE_YIELD; }
  if (has_block_node(ruby)) { return CONTROL_TYPE_BLOCK; }
  if (has_if_node(ruby)) { return CONTROL_TYPE_IF; }
  if (has_elsif_node(ruby)) { return CONTROL_TYPE_ELSIF; }
  if (has_else_node(ruby)) { return CONTROL_TYPE_ELSE; }
  if (has_end(ruby)) { return CONTROL_TYPE_END; }
  if (has_case_node(ruby)) { return CONTROL_TYPE_CASE; }
  if (has_case_match_node(ruby)) { return CONTROL_TYPE_CASE_MATCH; }
  if (has_when_node(ruby)) { return CONTROL_TYPE_WHEN; }
  if (has_in_node(ruby)) { return CONTROL_TYPE_IN; }
  if (has_begin_node(ruby)) { return CONTROL_TYPE_BEGIN; }
  if (has_rescue_node(ruby)) { return CONTROL_TYPE_RESCUE; }
  if (has_ensure_node(ruby)) { return CONTROL_TYPE_ENSURE; }
  if (has_unless_node(ruby)) { return CONTROL_TYPE_UNLESS; }
  if (has_while_node(ruby)) { return CONTROL_TYPE_WHILE; }
  if (has_until_node(ruby)) { return CONTROL_TYPE_UNTIL; }
  if (has_for_node(ruby)) { return CONTROL_TYPE_FOR; }
  if (has_block_closing(ruby)) { return CONTROL_TYPE_BLOCK_CLOSE; }

  return CONTROL_TYPE_UNKNOWN;
}

static bool is_subsequent_type(control_type_t parent_type, control_type_t child_type) {
  switch (parent_type) {
    case CONTROL_TYPE_IF:
    case CONTROL_TYPE_ELSIF: return child_type == CONTROL_TYPE_ELSIF || child_type == CONTROL_TYPE_ELSE;
    case CONTROL_TYPE_CASE:
    case CONTROL_TYPE_CASE_MATCH: return child_type == CONTROL_TYPE_WHEN || child_type == CONTROL_TYPE_ELSE;
    case CONTROL_TYPE_BEGIN:
      return child_type == CONTROL_TYPE_RESCUE || child_type == CONTROL_TYPE_ELSE || child_type == CONTROL_TYPE_ENSURE;
    case CONTROL_TYPE_RESCUE: return child_type == CONTROL_TYPE_RESCUE;
    case CONTROL_TYPE_UNLESS: return child_type == CONTROL_TYPE_ELSE;

    default: return false;
  }
}

static bool is_terminator_type(control_type_t parent_type, control_type_t child_type) {
  if (child_type == CONTROL_TYPE_END) { return true; }

  switch (parent_type) {
    case CONTROL_TYPE_WHEN: return child_type == CONTROL_TYPE_WHEN || child_type == CONTROL_TYPE_ELSE;
    case CONTROL_TYPE_IN: return child_type == CONTROL_TYPE_IN || child_type == CONTROL_TYPE_ELSE;
    case CONTROL_TYPE_BLOCK: return child_type == CONTROL_TYPE_BLOCK_CLOSE;

    default: return is_subsequent_type(parent_type, child_type);
  }
}

static AST_NODE_T* create_control_node(
  AST_ERB_CONTENT_NODE_T* erb_node,
  array_T* children,
  AST_NODE_T* subsequent,
  AST_ERB_END_NODE_T* end_node,
  control_type_t control_type
) {
  array_T* errors = array_init(8);
  position_T start_position = erb_node->tag_opening->location.start;
  position_T end_position = erb_node->tag_closing->location.end;

  if (end_node) {
    end_position = end_node->base.location.end;
  } else if (children && array_size(children) > 0) {
    AST_NODE_T* last_child = array_get(children, array_size(children) - 1);
    end_position = last_child->location.end;
  } else if (subsequent) {
    end_position = subsequent->location.end;
  }

  token_T* tag_opening = erb_node->tag_opening;
  token_T* content = erb_node->content;
  token_T* tag_closing = erb_node->tag_closing;

  switch (control_type) {
    case CONTROL_TYPE_IF:
    case CONTROL_TYPE_ELSIF:
      return (AST_NODE_T*) ast_erb_if_node_init(
        tag_opening,
        content,
        tag_closing,
        children,
        subsequent,
        end_node,
        start_position,
        end_position,
        errors
      );

    case CONTROL_TYPE_ELSE:
      return (AST_NODE_T*)
        ast_erb_else_node_init(tag_opening, content, tag_closing, children, start_position, end_position, errors);

    case CONTROL_TYPE_CASE:
    case CONTROL_TYPE_CASE_MATCH: {
      AST_ERB_ELSE_NODE_T* else_node = NULL;
      if (subsequent && subsequent->type == AST_ERB_ELSE_NODE) { else_node = (AST_ERB_ELSE_NODE_T*) subsequent; }

      array_T* when_conditions = array_init(8);
      array_T* in_conditions = array_init(8);
      array_T* non_when_non_in_children = array_init(8);

      for (size_t i = 0; i < array_size(children); i++) {
        AST_NODE_T* child = array_get(children, i);
        if (child && child->type == AST_ERB_WHEN_NODE) {
          array_append(when_conditions, child);
        } else if (child && child->type == AST_ERB_IN_NODE) {
          array_append(in_conditions, child);
        } else {
          array_append(non_when_non_in_children, child);
        }
      }

      if (array_size(in_conditions) > 0) {
        return (AST_NODE_T*) ast_erb_case_match_node_init(
          tag_opening,
          content,
          tag_closing,
          non_when_non_in_children,
          in_conditions,
          else_node,
          end_node,
          start_position,
          end_position,
          errors
        );
      }

      return (AST_NODE_T*) ast_erb_case_node_init(
        tag_opening,
        content,
        tag_closing,
        non_when_non_in_children,
        when_conditions,
        else_node,
        end_node,
        start_position,
        end_position,
        errors
      );
    }

    case CONTROL_TYPE_WHEN: {
      return (AST_NODE_T*)
        ast_erb_when_node_init(tag_opening, content, tag_closing, children, start_position, end_position, errors);
    }

    case CONTROL_TYPE_IN: {
      return (AST_NODE_T*)
        ast_erb_in_node_init(tag_opening, content, tag_closing, children, start_position, end_position, errors);
    }

    case CONTROL_TYPE_BEGIN: {
      AST_ERB_RESCUE_NODE_T* rescue_clause = NULL;
      AST_ERB_ELSE_NODE_T* else_clause = NULL;
      AST_ERB_ENSURE_NODE_T* ensure_clause = NULL;

      if (subsequent) {
        if (subsequent->type == AST_ERB_RESCUE_NODE) {
          rescue_clause = (AST_ERB_RESCUE_NODE_T*) subsequent;
        } else if (subsequent->type == AST_ERB_ELSE_NODE) {
          else_clause = (AST_ERB_ELSE_NODE_T*) subsequent;
        } else if (subsequent->type == AST_ERB_ENSURE_NODE) {
          ensure_clause = (AST_ERB_ENSURE_NODE_T*) subsequent;
        }
      }

      return (AST_NODE_T*) ast_erb_begin_node_init(
        tag_opening,
        content,
        tag_closing,
        children,
        rescue_clause,
        else_clause,
        ensure_clause,
        end_node,
        start_position,
        end_position,
        errors
      );
    }

    case CONTROL_TYPE_RESCUE: {
      AST_ERB_RESCUE_NODE_T* rescue_node = NULL;

      if (rescue_node && subsequent->type == AST_ERB_RESCUE_NODE) { rescue_node = (AST_ERB_RESCUE_NODE_T*) subsequent; }

      return (AST_NODE_T*) ast_erb_rescue_node_init(
        tag_opening,
        content,
        tag_closing,
        children,
        rescue_node,
        start_position,
        end_position,
        errors
      );
    }

    case CONTROL_TYPE_ENSURE: {
      return (AST_NODE_T*)
        ast_erb_ensure_node_init(tag_opening, content, tag_closing, children, start_position, end_position, errors);
    }

    case CONTROL_TYPE_UNLESS: {
      AST_ERB_ELSE_NODE_T* else_clause = NULL;

      if (subsequent && subsequent->type == AST_ERB_ELSE_NODE) { else_clause = (AST_ERB_ELSE_NODE_T*) subsequent; }

      return (AST_NODE_T*) ast_erb_unless_node_init(
        tag_opening,
        content,
        tag_closing,
        children,
        else_clause,
        end_node,
        start_position,
        end_position,
        errors
      );
    }

    case CONTROL_TYPE_WHILE: {
      return (AST_NODE_T*) ast_erb_while_node_init(
        tag_opening,
        content,
        tag_closing,
        children,
        end_node,
        start_position,
        end_position,
        errors
      );
    }

    case CONTROL_TYPE_UNTIL: {
      return (AST_NODE_T*) ast_erb_until_node_init(
        tag_opening,
        content,
        tag_closing,
        children,
        end_node,
        start_position,
        end_position,
        errors
      );
    }

    case CONTROL_TYPE_FOR: {
      return (AST_NODE_T*) ast_erb_for_node_init(
        tag_opening,
        content,
        tag_closing,
        children,
        end_node,
        start_position,
        end_position,
        errors
      );
    }

    case CONTROL_TYPE_BLOCK: {
      return (AST_NODE_T*) ast_erb_block_node_init(
        tag_opening,
        content,
        tag_closing,
        children,
        end_node,
        start_position,
        end_position,
        errors
      );
    }

    case CONTROL_TYPE_YIELD: {
      return (AST_NODE_T*)
        ast_erb_yield_node_init(tag_opening, content, tag_closing, start_position, end_position, errors);
    }

    default: array_free(&errors); return NULL;
  }
}

static size_t process_control_structure(
  AST_NODE_T* node,
  array_T* array,
  size_t index,
  array_T* output_array,
  analyze_ruby_context_T* context,
  control_type_t initial_type
) {
  AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) array_get(array, index);
  array_T* children = array_init(8);

  index++;

  if (initial_type == CONTROL_TYPE_CASE || initial_type == CONTROL_TYPE_CASE_MATCH) {
    array_T* when_conditions = array_init(8);
    array_T* in_conditions = array_init(8);
    array_T* non_when_non_in_children = array_init(8);

    while (index < array_size(array)) {
      AST_NODE_T* next_node = array_get(array, index);

      if (!next_node) { break; }

      if (next_node->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* erb_content = (AST_ERB_CONTENT_NODE_T*) next_node;
        control_type_t next_type = detect_control_type(erb_content);

        if (next_type == CONTROL_TYPE_WHEN || next_type == CONTROL_TYPE_IN) { break; }
      }

      array_append(non_when_non_in_children, next_node);
      index++;
    }

    while (index < array_size(array)) {
      AST_NODE_T* next_node = array_get(array, index);

      if (!next_node) { break; }

      if (next_node->type != AST_ERB_CONTENT_NODE) {
        array_append(non_when_non_in_children, next_node);
        index++;
        continue;
      }

      AST_ERB_CONTENT_NODE_T* erb_content = (AST_ERB_CONTENT_NODE_T*) next_node;
      control_type_t next_type = detect_control_type(erb_content);

      if (next_type == CONTROL_TYPE_WHEN) {
        array_T* when_statements = array_init(8);
        index++;

        index = process_block_children(node, array, index, when_statements, context, CONTROL_TYPE_WHEN);

        AST_ERB_WHEN_NODE_T* when_node = ast_erb_when_node_init(
          erb_content->tag_opening,
          erb_content->content,
          erb_content->tag_closing,
          when_statements,
          erb_content->tag_opening->location.start,
          erb_content->tag_closing->location.end,
          array_init(8)
        );

        array_append(when_conditions, (AST_NODE_T*) when_node);

        continue;
      } else if (next_type == CONTROL_TYPE_IN) {
        array_T* in_statements = array_init(8);
        index++;

        index = process_block_children(node, array, index, in_statements, context, CONTROL_TYPE_IN);

        AST_ERB_IN_NODE_T* in_node = ast_erb_in_node_init(
          erb_content->tag_opening,
          erb_content->content,
          erb_content->tag_closing,
          in_statements,
          erb_content->tag_opening->location.start,
          erb_content->tag_closing->location.end,
          array_init(8)
        );

        array_append(in_conditions, (AST_NODE_T*) in_node);

        continue;
      } else if (next_type == CONTROL_TYPE_ELSE || next_type == CONTROL_TYPE_END) {
        break;
      } else {
        array_append(non_when_non_in_children, next_node);
        index++;
      }
    }

    AST_ERB_ELSE_NODE_T* else_clause = NULL;

    if (index < array_size(array)) {
      AST_NODE_T* next_node = array_get(array, index);

      if (next_node && next_node->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* next_erb = (AST_ERB_CONTENT_NODE_T*) next_node;
        control_type_t next_type = detect_control_type(next_erb);

        if (next_type == CONTROL_TYPE_ELSE) {
          array_T* else_children = array_init(8);

          index++;

          while (index < array_size(array)) {
            AST_NODE_T* child = array_get(array, index);

            if (!child) { break; }

            if (child->type == AST_ERB_CONTENT_NODE) {
              AST_ERB_CONTENT_NODE_T* child_erb = (AST_ERB_CONTENT_NODE_T*) child;
              control_type_t child_type = detect_control_type(child_erb);

              if (child_type == CONTROL_TYPE_END) { break; }
            }

            array_append(else_children, child);
            index++;
          }

          else_clause = ast_erb_else_node_init(
            next_erb->tag_opening,
            next_erb->content,
            next_erb->tag_closing,
            else_children,
            next_erb->tag_opening->location.start,
            next_erb->tag_closing->location.end,
            array_init(8)
          );
        }
      }
    }

    AST_ERB_END_NODE_T* end_node = NULL;

    if (index < array_size(array)) {
      AST_NODE_T* potential_end = array_get(array, index);

      if (potential_end && potential_end->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* end_erb = (AST_ERB_CONTENT_NODE_T*) potential_end;

        if (detect_control_type(end_erb) == CONTROL_TYPE_END) {
          end_node = ast_erb_end_node_init(
            end_erb->tag_opening,
            end_erb->content,
            end_erb->tag_closing,
            end_erb->tag_opening->location.start,
            end_erb->tag_closing->location.end,
            end_erb->base.errors
          );

          index++;
        }
      }
    }

    position_T start_position = erb_node->tag_opening->location.start;
    position_T end_position = erb_node->tag_closing->location.end;

    if (end_node) {
      end_position = end_node->base.location.end;
    } else if (else_clause) {
      end_position = else_clause->base.location.end;
    } else if (array_size(when_conditions) > 0) {
      AST_NODE_T* last_when = array_get(when_conditions, array_size(when_conditions) - 1);
      end_position = last_when->location.end;
    } else if (array_size(in_conditions) > 0) {
      AST_NODE_T* last_in = array_get(in_conditions, array_size(in_conditions) - 1);
      end_position = last_in->location.end;
    }

    if (array_size(in_conditions) > 0) {
      AST_ERB_CASE_MATCH_NODE_T* case_match_node = ast_erb_case_match_node_init(
        erb_node->tag_opening,
        erb_node->content,
        erb_node->tag_closing,
        non_when_non_in_children,
        in_conditions,
        else_clause,
        end_node,
        start_position,
        end_position,
        array_init(8)
      );

      array_append(output_array, (AST_NODE_T*) case_match_node);
      return index;
    }

    AST_ERB_CASE_NODE_T* case_node = ast_erb_case_node_init(
      erb_node->tag_opening,
      erb_node->content,
      erb_node->tag_closing,
      non_when_non_in_children,
      when_conditions,
      else_clause,
      end_node,
      start_position,
      end_position,
      array_init(8)
    );

    array_append(output_array, (AST_NODE_T*) case_node);
    return index;
  }

  if (initial_type == CONTROL_TYPE_BEGIN) {
    index = process_block_children(node, array, index, children, context, initial_type);

    AST_ERB_RESCUE_NODE_T* rescue_clause = NULL;
    AST_ERB_ELSE_NODE_T* else_clause = NULL;
    AST_ERB_ENSURE_NODE_T* ensure_clause = NULL;

    if (index < array_size(array)) {
      AST_NODE_T* next_node = array_get(array, index);

      if (next_node && next_node->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* next_erb = (AST_ERB_CONTENT_NODE_T*) next_node;
        control_type_t next_type = detect_control_type(next_erb);

        if (next_type == CONTROL_TYPE_RESCUE) {
          AST_NODE_T* rescue_node = NULL;
          index = process_subsequent_block(node, array, index, &rescue_node, context, initial_type);
          rescue_clause = (AST_ERB_RESCUE_NODE_T*) rescue_node;
        }
      }
    }

    if (index < array_size(array)) {
      AST_NODE_T* next_node = array_get(array, index);

      if (next_node && next_node->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* next_erb = (AST_ERB_CONTENT_NODE_T*) next_node;
        control_type_t next_type = detect_control_type(next_erb);

        if (next_type == CONTROL_TYPE_ELSE) {
          array_T* else_children = array_init(8);

          index++;

          while (index < array_size(array)) {
            AST_NODE_T* child = array_get(array, index);

            if (!child) { break; }

            if (child->type == AST_ERB_CONTENT_NODE) {
              AST_ERB_CONTENT_NODE_T* child_erb = (AST_ERB_CONTENT_NODE_T*) child;
              control_type_t child_type = detect_control_type(child_erb);

              if (child_type == CONTROL_TYPE_ENSURE || child_type == CONTROL_TYPE_END) { break; }
            }

            array_append(else_children, child);
            index++;
          }

          else_clause = ast_erb_else_node_init(
            next_erb->tag_opening,
            next_erb->content,
            next_erb->tag_closing,
            else_children,
            next_erb->tag_opening->location.start,
            next_erb->tag_closing->location.end,
            array_init(8)
          );
        }
      }
    }

    if (index < array_size(array)) {
      AST_NODE_T* next_node = array_get(array, index);

      if (next_node && next_node->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* next_erb = (AST_ERB_CONTENT_NODE_T*) next_node;
        control_type_t next_type = detect_control_type(next_erb);

        if (next_type == CONTROL_TYPE_ENSURE) {
          array_T* ensure_children = array_init(8);

          index++;

          while (index < array_size(array)) {
            AST_NODE_T* child = array_get(array, index);

            if (!child) { break; }

            if (child->type == AST_ERB_CONTENT_NODE) {
              AST_ERB_CONTENT_NODE_T* child_erb = (AST_ERB_CONTENT_NODE_T*) child;
              control_type_t child_type = detect_control_type(child_erb);

              if (child_type == CONTROL_TYPE_END) { break; }
            }

            array_append(ensure_children, child);
            index++;
          }

          ensure_clause = ast_erb_ensure_node_init(
            next_erb->tag_opening,
            next_erb->content,
            next_erb->tag_closing,
            ensure_children,
            next_erb->tag_opening->location.start,
            next_erb->tag_closing->location.end,
            array_init(8)
          );
        }
      }
    }

    AST_ERB_END_NODE_T* end_node = NULL;

    if (index < array_size(array)) {
      AST_NODE_T* potential_end = array_get(array, index);

      if (potential_end && potential_end->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* end_erb = (AST_ERB_CONTENT_NODE_T*) potential_end;

        if (detect_control_type(end_erb) == CONTROL_TYPE_END) {
          end_node = ast_erb_end_node_init(
            end_erb->tag_opening,
            end_erb->content,
            end_erb->tag_closing,
            end_erb->tag_opening->location.start,
            end_erb->tag_closing->location.end,
            end_erb->base.errors
          );

          index++;
        }
      }
    }

    position_T start_position = erb_node->tag_opening->location.start;
    position_T end_position = erb_node->tag_closing->location.end;

    if (end_node) {
      end_position = end_node->base.location.end;
    } else if (ensure_clause) {
      end_position = ensure_clause->base.location.end;
    } else if (else_clause) {
      end_position = else_clause->base.location.end;
    } else if (rescue_clause) {
      end_position = rescue_clause->base.location.end;
    }

    AST_ERB_BEGIN_NODE_T* begin_node = ast_erb_begin_node_init(
      erb_node->tag_opening,
      erb_node->content,
      erb_node->tag_closing,
      children,
      rescue_clause,
      else_clause,
      ensure_clause,
      end_node,
      start_position,
      end_position,
      array_init(8)
    );

    array_append(output_array, (AST_NODE_T*) begin_node);
    return index;
  }

  if (initial_type == CONTROL_TYPE_BLOCK) {
    index = process_block_children(node, array, index, children, context, initial_type);

    AST_ERB_END_NODE_T* end_node = NULL;

    if (index < array_size(array)) {
      AST_NODE_T* potential_close = array_get(array, index);

      if (potential_close && potential_close->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* close_erb = (AST_ERB_CONTENT_NODE_T*) potential_close;
        control_type_t close_type = detect_control_type(close_erb);

        if (close_type == CONTROL_TYPE_BLOCK_CLOSE || close_type == CONTROL_TYPE_END) {
          end_node = ast_erb_end_node_init(
            close_erb->tag_opening,
            close_erb->content,
            close_erb->tag_closing,
            close_erb->tag_opening->location.start,
            close_erb->tag_closing->location.end,
            close_erb->base.errors
          );

          index++;
        }
      }
    }

    position_T start_position = erb_node->tag_opening->location.start;
    position_T end_position = erb_node->tag_closing->location.end;

    if (end_node) {
      end_position = end_node->base.location.end;
    } else if (children && array_size(children) > 0) {
      AST_NODE_T* last_child = array_get(children, array_size(children) - 1);
      end_position = last_child->location.end;
    }

    AST_ERB_BLOCK_NODE_T* block_node = ast_erb_block_node_init(
      erb_node->tag_opening,
      erb_node->content,
      erb_node->tag_closing,
      children,
      end_node,
      start_position,
      end_position,
      array_init(8)
    );

    array_append(output_array, (AST_NODE_T*) block_node);
    return index;
  }

  index = process_block_children(node, array, index, children, context, initial_type);

  AST_NODE_T* subsequent = NULL;
  AST_ERB_END_NODE_T* end_node = NULL;

  if (index < array_size(array)) {
    AST_NODE_T* next_node = array_get(array, index);

    if (next_node && next_node->type == AST_ERB_CONTENT_NODE) {
      AST_ERB_CONTENT_NODE_T* next_erb = (AST_ERB_CONTENT_NODE_T*) next_node;
      control_type_t next_type = detect_control_type(next_erb);

      if (is_subsequent_type(initial_type, next_type)) {
        index = process_subsequent_block(node, array, index, &subsequent, context, initial_type);
      }
    }
  }

  if (index < array_size(array)) {
    AST_NODE_T* potential_end = array_get(array, index);

    if (potential_end && potential_end->type == AST_ERB_CONTENT_NODE) {
      AST_ERB_CONTENT_NODE_T* end_erb = (AST_ERB_CONTENT_NODE_T*) potential_end;

      if (detect_control_type(end_erb) == CONTROL_TYPE_END) {
        end_node = ast_erb_end_node_init(
          end_erb->tag_opening,
          end_erb->content,
          end_erb->tag_closing,
          end_erb->tag_opening->location.start,
          end_erb->tag_closing->location.end,
          end_erb->base.errors
        );

        index++;
      }
    }
  }

  AST_NODE_T* control_node = create_control_node(erb_node, children, subsequent, end_node, initial_type);

  if (control_node) { array_append(output_array, control_node); }

  return index;
}

static size_t process_subsequent_block(
  AST_NODE_T* node,
  array_T* array,
  size_t index,
  AST_NODE_T** subsequent_out,
  analyze_ruby_context_T* context,
  control_type_t parent_type
) {
  AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) array_get(array, index);
  control_type_t type = detect_control_type(erb_node);
  array_T* children = array_init(8);

  index++;

  index = process_block_children(node, array, index, children, context, parent_type);

  AST_NODE_T* subsequent_node = create_control_node(erb_node, children, NULL, NULL, type);

  if (index < array_size(array)) {
    AST_NODE_T* next_node = array_get(array, index);

    if (next_node && next_node->type == AST_ERB_CONTENT_NODE) {
      AST_ERB_CONTENT_NODE_T* next_erb = (AST_ERB_CONTENT_NODE_T*) next_node;
      control_type_t next_type = detect_control_type(next_erb);

      if (is_subsequent_type(parent_type, next_type)
          && !(type == CONTROL_TYPE_RESCUE && (next_type == CONTROL_TYPE_ELSE || next_type == CONTROL_TYPE_ENSURE))) {

        AST_NODE_T** next_subsequent = NULL;

        switch (type) {
          case CONTROL_TYPE_ELSIF: {
            if (subsequent_node->type == AST_ERB_IF_NODE) {
              next_subsequent = &(((AST_ERB_IF_NODE_T*) subsequent_node)->subsequent);
            }

            break;
          }

          case CONTROL_TYPE_RESCUE: {
            if (subsequent_node->type == AST_ERB_RESCUE_NODE && next_type == CONTROL_TYPE_RESCUE) {
              AST_NODE_T* next_rescue_node = NULL;
              index = process_subsequent_block(node, array, index, &next_rescue_node, context, parent_type);

              if (next_rescue_node) {
                ((AST_ERB_RESCUE_NODE_T*) subsequent_node)->subsequent = (AST_ERB_RESCUE_NODE_T*) next_rescue_node;
              }

              next_subsequent = NULL;
            }

            break;
          }

          default: break;
        }

        if (next_subsequent) {
          index = process_subsequent_block(node, array, index, next_subsequent, context, parent_type);
        }
      }
    }
  }

  *subsequent_out = subsequent_node;
  return index;
}

static size_t process_block_children(
  AST_NODE_T* node,
  array_T* array,
  size_t index,
  array_T* children_array,
  analyze_ruby_context_T* context,
  control_type_t parent_type
) {
  while (index < array_size(array)) {
    AST_NODE_T* child = array_get(array, index);

    if (!child) { break; }

    if (child->type != AST_ERB_CONTENT_NODE) {
      array_append(children_array, child);
      index++;
      continue;
    }

    AST_ERB_CONTENT_NODE_T* erb_content = (AST_ERB_CONTENT_NODE_T*) child;
    control_type_t child_type = detect_control_type(erb_content);

    if (is_terminator_type(parent_type, child_type)) { break; }

    if (child_type == CONTROL_TYPE_IF || child_type == CONTROL_TYPE_CASE || child_type == CONTROL_TYPE_CASE_MATCH
        || child_type == CONTROL_TYPE_BEGIN || child_type == CONTROL_TYPE_UNLESS || child_type == CONTROL_TYPE_WHILE
        || child_type == CONTROL_TYPE_UNTIL || child_type == CONTROL_TYPE_FOR || child_type == CONTROL_TYPE_BLOCK) {
      array_T* temp_array = array_init(1);
      size_t new_index = process_control_structure(node, array, index, temp_array, context, child_type);

      if (array_size(temp_array) > 0) { array_append(children_array, array_get(temp_array, 0)); }

      array_free(&temp_array);

      index = new_index;
      continue;
    }

    array_append(children_array, child);
    index++;
  }

  return index;
}

static array_T* rewrite_node_array(AST_NODE_T* node, array_T* array, analyze_ruby_context_T* context) {
  array_T* new_array = array_init(array_size(array));
  size_t index = 0;

  while (index < array_size(array)) {
    AST_NODE_T* item = array_get(array, index);

    if (!item) { break; }

    if (item->type != AST_ERB_CONTENT_NODE) {
      array_append(new_array, item);
      index++;
      continue;
    }

    AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) item;
    control_type_t type = detect_control_type(erb_node);

    switch (type) {
      case CONTROL_TYPE_IF:
      case CONTROL_TYPE_CASE:
      case CONTROL_TYPE_CASE_MATCH:
      case CONTROL_TYPE_BEGIN:
      case CONTROL_TYPE_UNLESS:
      case CONTROL_TYPE_WHILE:
      case CONTROL_TYPE_UNTIL:
      case CONTROL_TYPE_FOR:
      case CONTROL_TYPE_BLOCK:
        index = process_control_structure(node, array, index, new_array, context, type);
        continue;

      case CONTROL_TYPE_YIELD: {
        AST_NODE_T* yield_node = create_control_node(erb_node, array_init(8), NULL, NULL, type);

        if (yield_node) {
          array_append(new_array, yield_node);
        } else {
          array_append(new_array, item);
        }

        index++;
        break;
      }

      default:
        array_append(new_array, item);
        index++;
        break;
    }
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
    array_free(&old_array);
  }

  if (node->type == AST_HTML_ELEMENT_NODE) {
    AST_HTML_ELEMENT_NODE_T* element_node = (AST_HTML_ELEMENT_NODE_T*) node;
    array_T* old_array = element_node->body;
    element_node->body = rewrite_node_array((AST_NODE_T*) node, element_node->body, context);
    array_free(&old_array);
  }

  if (node->type == AST_HTML_OPEN_TAG_NODE) {
    AST_HTML_OPEN_TAG_NODE_T* open_tag = (AST_HTML_OPEN_TAG_NODE_T*) node;
    array_T* old_array = open_tag->children;
    open_tag->children = rewrite_node_array((AST_NODE_T*) node, open_tag->children, context);
    array_free(&old_array);
  }

  if (node->type == AST_HTML_ATTRIBUTE_VALUE_NODE) {
    AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node = (AST_HTML_ATTRIBUTE_VALUE_NODE_T*) node;
    array_T* old_array = value_node->children;
    value_node->children = rewrite_node_array((AST_NODE_T*) node, value_node->children, context);
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
  pm_options_t options = { 0, .partial_script = true };
  pm_parser_init(&parser, (const uint8_t*) extracted_ruby, strlen(extracted_ruby), &options);

  pm_node_t* root = pm_parse(&parser);

  for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) parser.error_list.head; error != NULL;
       error = (const pm_diagnostic_t*) error->node.next) {

    RUBY_PARSE_ERROR_T* parse_error = ruby_parse_error_from_prism_error(error, (AST_NODE_T*) document, source, &parser);
    array_append(document->base.errors, parse_error);
  }

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);
  pm_options_free(&options);
  free(extracted_ruby);
}
