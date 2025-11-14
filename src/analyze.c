#include "include/analyze.h"
#include "include/analyze_helpers.h"
#include "include/analyzed_ruby.h"
#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/errors.h"
#include "include/extract.h"
#include "include/location.h"
#include "include/parser.h"
#include "include/position.h"
#include "include/pretty_print.h"
#include "include/prism_helpers.h"
#include "include/token_struct.h"
#include "include/util.h"
#include "include/util/hb_array.h"
#include "include/util/hb_string.h"
#include "include/visitor.h"

#include <prism.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static analyzed_ruby_T* herb_analyze_ruby(hb_string_T source) {
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
      analyzed_ruby_T* analyzed = herb_analyze_ruby(hb_string(erb_content_node->content->value));

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
  hb_array_T* array,
  size_t index,
  hb_array_T* children_array,
  analyze_ruby_context_T* context,
  control_type_t parent_type
);

static size_t process_subsequent_block(
  AST_NODE_T* node,
  hb_array_T* array,
  size_t index,
  AST_NODE_T** subsequent_out,
  analyze_ruby_context_T* context,
  control_type_t parent_type
);

typedef struct {
  control_type_t type;
  uint32_t offset;
  bool found;
} earliest_control_keyword_t;

typedef struct {
  earliest_control_keyword_t* result;
  const uint8_t* source_start;
} location_walker_context_t;

static bool find_earliest_control_keyword_walker(const pm_node_t* node, void* data) {
  if (!node) { return true; }

  location_walker_context_t* context = (location_walker_context_t*) data;
  earliest_control_keyword_t* result = context->result;

  control_type_t current_type = CONTROL_TYPE_UNKNOWN;
  uint32_t keyword_offset = UINT32_MAX;

  switch (node->type) {
    case PM_IF_NODE: {
      pm_if_node_t* if_node = (pm_if_node_t*) node;
      current_type = CONTROL_TYPE_IF;
      keyword_offset = (uint32_t) (if_node->if_keyword_loc.start - context->source_start);
      break;
    }

    case PM_UNLESS_NODE: {
      pm_unless_node_t* unless_node = (pm_unless_node_t*) node;
      current_type = CONTROL_TYPE_UNLESS;
      keyword_offset = (uint32_t) (unless_node->keyword_loc.start - context->source_start);
      break;
    }

    case PM_CASE_NODE: {
      pm_case_node_t* case_node = (pm_case_node_t*) node;
      current_type = CONTROL_TYPE_CASE;
      keyword_offset = (uint32_t) (case_node->case_keyword_loc.start - context->source_start);
      break;
    }

    case PM_CASE_MATCH_NODE: {
      pm_case_match_node_t* case_match_node = (pm_case_match_node_t*) node;
      current_type = CONTROL_TYPE_CASE_MATCH;
      keyword_offset = (uint32_t) (case_match_node->case_keyword_loc.start - context->source_start);
      break;
    }

    case PM_WHILE_NODE: {
      pm_while_node_t* while_node = (pm_while_node_t*) node;
      current_type = CONTROL_TYPE_WHILE;
      keyword_offset = (uint32_t) (while_node->keyword_loc.start - context->source_start);
      break;
    }

    case PM_UNTIL_NODE: {
      pm_until_node_t* until_node = (pm_until_node_t*) node;
      current_type = CONTROL_TYPE_UNTIL;
      keyword_offset = (uint32_t) (until_node->keyword_loc.start - context->source_start);
      break;
    }

    case PM_FOR_NODE: {
      pm_for_node_t* for_node = (pm_for_node_t*) node;
      current_type = CONTROL_TYPE_FOR;
      keyword_offset = (uint32_t) (for_node->for_keyword_loc.start - context->source_start);
      break;
    }

    case PM_BEGIN_NODE: {
      pm_begin_node_t* begin_node = (pm_begin_node_t*) node;
      current_type = CONTROL_TYPE_BEGIN;

      if (begin_node->begin_keyword_loc.start != NULL) {
        keyword_offset = (uint32_t) (begin_node->begin_keyword_loc.start - context->source_start);
      } else {
        keyword_offset = (uint32_t) (node->location.start - context->source_start);
      }
      break;
    }

    case PM_YIELD_NODE: {
      current_type = CONTROL_TYPE_YIELD;
      keyword_offset = (uint32_t) (node->location.start - context->source_start);
      break;
    }

    case PM_CALL_NODE: {
      pm_call_node_t* call = (pm_call_node_t*) node;

      if (call->block != NULL) {
        current_type = CONTROL_TYPE_BLOCK;
        keyword_offset = (uint32_t) (node->location.start - context->source_start);
      }
      break;
    }

    case PM_NEXT_NODE:
    case PM_BREAK_NODE:
    case PM_RETURN_NODE: {
      current_type = CONTROL_TYPE_UNKNOWN;
      keyword_offset = (uint32_t) (node->location.start - context->source_start);
      break;
    }

    default: break;
  }

  if (keyword_offset != UINT32_MAX) {
    if (!result->found || keyword_offset < result->offset) {
      result->type = current_type;
      result->offset = keyword_offset;
      result->found = true;
    }
  }

  return true;
}

static control_type_t find_earliest_control_keyword(pm_node_t* root, const uint8_t* source_start) {
  if (!root) { return CONTROL_TYPE_UNKNOWN; }

  earliest_control_keyword_t result = { .type = CONTROL_TYPE_UNKNOWN, .offset = UINT32_MAX, .found = false };

  location_walker_context_t context = { .result = &result, .source_start = source_start };

  pm_visit_node(root, find_earliest_control_keyword_walker, &context);

  return result.found ? result.type : CONTROL_TYPE_UNKNOWN;
}

static control_type_t detect_control_type(AST_ERB_CONTENT_NODE_T* erb_node) {
  if (!erb_node || erb_node->base.type != AST_ERB_CONTENT_NODE) { return CONTROL_TYPE_UNKNOWN; }

  analyzed_ruby_T* ruby = erb_node->analyzed_ruby;

  if (!ruby) { return CONTROL_TYPE_UNKNOWN; }

  if (ruby->valid) { return CONTROL_TYPE_UNKNOWN; }

  pm_node_t* root = ruby->root;

  if (has_elsif_node(ruby)) { return CONTROL_TYPE_ELSIF; }
  if (has_else_node(ruby)) { return CONTROL_TYPE_ELSE; }
  if (has_end(ruby)) { return CONTROL_TYPE_END; }
  if (has_when_node(ruby)) { return CONTROL_TYPE_WHEN; }
  if (has_in_node(ruby)) { return CONTROL_TYPE_IN; }
  if (has_rescue_node(ruby)) { return CONTROL_TYPE_RESCUE; }
  if (has_ensure_node(ruby)) { return CONTROL_TYPE_ENSURE; }
  if (has_block_closing(ruby)) { return CONTROL_TYPE_BLOCK_CLOSE; }

  return find_earliest_control_keyword(root, ruby->parser.start);
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
  hb_array_T* children,
  AST_NODE_T* subsequent,
  AST_ERB_END_NODE_T* end_node,
  control_type_t control_type
) {
  hb_array_T* errors = erb_node->base.errors;
  erb_node->base.errors = NULL;

  position_T start_position = erb_node->tag_opening->location.start;
  position_T end_position = erb_node->tag_closing->location.end;

  if (end_node) {
    end_position = end_node->base.location.end;
  } else if (children && children->size > 0) {
    AST_NODE_T* last_child = hb_array_get(children, children->size - 1);
    end_position = last_child->location.end;
  } else if (subsequent) {
    end_position = subsequent->location.end;
  }

  token_T* tag_opening = erb_node->tag_opening;
  token_T* content = erb_node->content;
  token_T* tag_closing = erb_node->tag_closing;

  switch (control_type) {
    case CONTROL_TYPE_IF:
    case CONTROL_TYPE_ELSIF: {
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
    }

    case CONTROL_TYPE_ELSE: {
      return (
        AST_NODE_T*
      ) ast_erb_else_node_init(tag_opening, content, tag_closing, children, start_position, end_position, errors);
    }

    case CONTROL_TYPE_CASE:
    case CONTROL_TYPE_CASE_MATCH: {
      AST_ERB_ELSE_NODE_T* else_node = NULL;
      if (subsequent && subsequent->type == AST_ERB_ELSE_NODE) { else_node = (AST_ERB_ELSE_NODE_T*) subsequent; }

      hb_array_T* when_conditions = hb_array_init(8);
      hb_array_T* in_conditions = hb_array_init(8);
      hb_array_T* non_when_non_in_children = hb_array_init(8);

      for (size_t i = 0; i < children->size; i++) {
        AST_NODE_T* child = hb_array_get(children, i);

        if (child && child->type == AST_ERB_WHEN_NODE) {
          hb_array_append(when_conditions, child);
        } else if (child && child->type == AST_ERB_IN_NODE) {
          hb_array_append(in_conditions, child);
        } else {
          hb_array_append(non_when_non_in_children, child);
        }
      }

      hb_array_free(&children);

      if (in_conditions->size > 0) {
        hb_array_free(&when_conditions);

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
      } else {
        hb_array_free(&in_conditions);

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
    }

    case CONTROL_TYPE_WHEN: {
      return (
        AST_NODE_T*
      ) ast_erb_when_node_init(tag_opening, content, tag_closing, children, start_position, end_position, errors);
    }

    case CONTROL_TYPE_IN: {
      return (
        AST_NODE_T*
      ) ast_erb_in_node_init(tag_opening, content, tag_closing, children, start_position, end_position, errors);
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
      return (
        AST_NODE_T*
      ) ast_erb_ensure_node_init(tag_opening, content, tag_closing, children, start_position, end_position, errors);
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
      return (
        AST_NODE_T*
      ) ast_erb_yield_node_init(tag_opening, content, tag_closing, start_position, end_position, errors);
    }

    default: return NULL;
  }
}

static size_t process_control_structure(
  AST_NODE_T* node,
  hb_array_T* array,
  size_t index,
  hb_array_T* output_array,
  analyze_ruby_context_T* context,
  control_type_t initial_type
) {
  AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) hb_array_get(array, index);
  hb_array_T* children = hb_array_init(8);

  index++;

  if (initial_type == CONTROL_TYPE_CASE || initial_type == CONTROL_TYPE_CASE_MATCH) {
    hb_array_T* when_conditions = hb_array_init(8);
    hb_array_T* in_conditions = hb_array_init(8);
    hb_array_T* non_when_non_in_children = hb_array_init(8);

    while (index < array->size) {
      AST_NODE_T* next_node = hb_array_get(array, index);

      if (!next_node) { break; }

      if (next_node->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* erb_content = (AST_ERB_CONTENT_NODE_T*) next_node;
        control_type_t next_type = detect_control_type(erb_content);

        if (next_type == CONTROL_TYPE_WHEN || next_type == CONTROL_TYPE_IN) { break; }
      }

      hb_array_append(non_when_non_in_children, next_node);
      index++;
    }

    while (index < array->size) {
      AST_NODE_T* next_node = hb_array_get(array, index);

      if (!next_node) { break; }

      if (next_node->type != AST_ERB_CONTENT_NODE) {
        hb_array_append(non_when_non_in_children, next_node);
        index++;
        continue;
      }

      AST_ERB_CONTENT_NODE_T* erb_content = (AST_ERB_CONTENT_NODE_T*) next_node;
      control_type_t next_type = detect_control_type(erb_content);

      if (next_type == CONTROL_TYPE_WHEN) {
        hb_array_T* when_statements = hb_array_init(8);
        index++;

        index = process_block_children(node, array, index, when_statements, context, CONTROL_TYPE_WHEN);

        hb_array_T* when_errors = erb_content->base.errors;
        erb_content->base.errors = NULL;

        AST_ERB_WHEN_NODE_T* when_node = ast_erb_when_node_init(
          erb_content->tag_opening,
          erb_content->content,
          erb_content->tag_closing,
          when_statements,
          erb_content->tag_opening->location.start,
          erb_content->tag_closing->location.end,
          when_errors
        );

        ast_node_free((AST_NODE_T*) erb_content);

        hb_array_append(when_conditions, (AST_NODE_T*) when_node);

        continue;
      } else if (next_type == CONTROL_TYPE_IN) {
        hb_array_T* in_statements = hb_array_init(8);
        index++;

        index = process_block_children(node, array, index, in_statements, context, CONTROL_TYPE_IN);

        hb_array_T* in_errors = erb_content->base.errors;
        erb_content->base.errors = NULL;

        AST_ERB_IN_NODE_T* in_node = ast_erb_in_node_init(
          erb_content->tag_opening,
          erb_content->content,
          erb_content->tag_closing,
          in_statements,
          erb_content->tag_opening->location.start,
          erb_content->tag_closing->location.end,
          in_errors
        );

        ast_node_free((AST_NODE_T*) erb_content);

        hb_array_append(in_conditions, (AST_NODE_T*) in_node);

        continue;
      } else if (next_type == CONTROL_TYPE_ELSE || next_type == CONTROL_TYPE_END) {
        break;
      } else {
        hb_array_append(non_when_non_in_children, next_node);
        index++;
      }
    }

    AST_ERB_ELSE_NODE_T* else_clause = NULL;

    if (index < array->size) {
      AST_NODE_T* next_node = hb_array_get(array, index);

      if (next_node && next_node->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* next_erb = (AST_ERB_CONTENT_NODE_T*) next_node;
        control_type_t next_type = detect_control_type(next_erb);

        if (next_type == CONTROL_TYPE_ELSE) {
          hb_array_T* else_children = hb_array_init(8);

          index++;

          index = process_block_children(node, array, index, else_children, context, initial_type);

          hb_array_T* else_errors = next_erb->base.errors;
          next_erb->base.errors = NULL;

          else_clause = ast_erb_else_node_init(
            next_erb->tag_opening,
            next_erb->content,
            next_erb->tag_closing,
            else_children,
            next_erb->tag_opening->location.start,
            next_erb->tag_closing->location.end,
            else_errors
          );

          ast_node_free((AST_NODE_T*) next_erb);
        }
      }
    }

    AST_ERB_END_NODE_T* end_node = NULL;

    if (index < array->size) {
      AST_NODE_T* potential_end = hb_array_get(array, index);

      if (potential_end && potential_end->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* end_erb = (AST_ERB_CONTENT_NODE_T*) potential_end;

        if (detect_control_type(end_erb) == CONTROL_TYPE_END) {
          hb_array_T* end_errors = end_erb->base.errors;
          end_erb->base.errors = NULL;

          end_node = ast_erb_end_node_init(
            end_erb->tag_opening,
            end_erb->content,
            end_erb->tag_closing,
            end_erb->tag_opening->location.start,
            end_erb->tag_closing->location.end,
            end_errors
          );

          ast_node_free((AST_NODE_T*) end_erb);

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
    } else if (when_conditions->size > 0) {
      AST_NODE_T* last_when = hb_array_get(when_conditions, when_conditions->size - 1);
      end_position = last_when->location.end;
    } else if (in_conditions->size > 0) {
      AST_NODE_T* last_in = hb_array_get(in_conditions, in_conditions->size - 1);
      end_position = last_in->location.end;
    }

    if (in_conditions->size > 0) {
      hb_array_T* case_match_errors = erb_node->base.errors;
      erb_node->base.errors = NULL;

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
        case_match_errors
      );

      ast_node_free((AST_NODE_T*) erb_node);

      hb_array_append(output_array, (AST_NODE_T*) case_match_node);
      hb_array_free(&when_conditions);
      hb_array_free(&children);

      return index;
    }

    hb_array_T* case_errors = erb_node->base.errors;
    erb_node->base.errors = NULL;

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
      case_errors
    );

    ast_node_free((AST_NODE_T*) erb_node);

    hb_array_append(output_array, (AST_NODE_T*) case_node);
    hb_array_free(&in_conditions);
    hb_array_free(&children);

    return index;
  }

  if (initial_type == CONTROL_TYPE_BEGIN) {
    index = process_block_children(node, array, index, children, context, initial_type);

    AST_ERB_RESCUE_NODE_T* rescue_clause = NULL;
    AST_ERB_ELSE_NODE_T* else_clause = NULL;
    AST_ERB_ENSURE_NODE_T* ensure_clause = NULL;

    if (index < array->size) {
      AST_NODE_T* next_node = hb_array_get(array, index);

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

    if (index < array->size) {
      AST_NODE_T* next_node = hb_array_get(array, index);

      if (next_node && next_node->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* next_erb = (AST_ERB_CONTENT_NODE_T*) next_node;
        control_type_t next_type = detect_control_type(next_erb);

        if (next_type == CONTROL_TYPE_ELSE) {
          hb_array_T* else_children = hb_array_init(8);

          index++;

          index = process_block_children(node, array, index, else_children, context, initial_type);

          hb_array_T* else_errors = next_erb->base.errors;
          next_erb->base.errors = NULL;

          else_clause = ast_erb_else_node_init(
            next_erb->tag_opening,
            next_erb->content,
            next_erb->tag_closing,
            else_children,
            next_erb->tag_opening->location.start,
            next_erb->tag_closing->location.end,
            else_errors
          );

          ast_node_free((AST_NODE_T*) next_erb);
        }
      }
    }

    if (index < array->size) {
      AST_NODE_T* next_node = hb_array_get(array, index);

      if (next_node && next_node->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* next_erb = (AST_ERB_CONTENT_NODE_T*) next_node;
        control_type_t next_type = detect_control_type(next_erb);

        if (next_type == CONTROL_TYPE_ENSURE) {
          hb_array_T* ensure_children = hb_array_init(8);

          index++;

          while (index < array->size) {
            AST_NODE_T* child = hb_array_get(array, index);

            if (!child) { break; }

            if (child->type == AST_ERB_CONTENT_NODE) {
              AST_ERB_CONTENT_NODE_T* child_erb = (AST_ERB_CONTENT_NODE_T*) child;
              control_type_t child_type = detect_control_type(child_erb);

              if (child_type == CONTROL_TYPE_END) { break; }
            }

            hb_array_append(ensure_children, child);
            index++;
          }

          hb_array_T* ensure_errors = next_erb->base.errors;
          next_erb->base.errors = NULL;

          ensure_clause = ast_erb_ensure_node_init(
            next_erb->tag_opening,
            next_erb->content,
            next_erb->tag_closing,
            ensure_children,
            next_erb->tag_opening->location.start,
            next_erb->tag_closing->location.end,
            ensure_errors
          );

          ast_node_free((AST_NODE_T*) next_erb);
        }
      }
    }

    AST_ERB_END_NODE_T* end_node = NULL;

    if (index < array->size) {
      AST_NODE_T* potential_end = hb_array_get(array, index);

      if (potential_end && potential_end->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* end_erb = (AST_ERB_CONTENT_NODE_T*) potential_end;

        if (detect_control_type(end_erb) == CONTROL_TYPE_END) {
          hb_array_T* end_errors = end_erb->base.errors;
          end_erb->base.errors = NULL;

          end_node = ast_erb_end_node_init(
            end_erb->tag_opening,
            end_erb->content,
            end_erb->tag_closing,
            end_erb->tag_opening->location.start,
            end_erb->tag_closing->location.end,
            end_errors
          );

          ast_node_free((AST_NODE_T*) end_erb);

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

    hb_array_T* begin_errors = erb_node->base.errors;
    erb_node->base.errors = NULL;

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
      begin_errors
    );

    ast_node_free((AST_NODE_T*) erb_node);

    hb_array_append(output_array, (AST_NODE_T*) begin_node);
    return index;
  }

  if (initial_type == CONTROL_TYPE_BLOCK) {
    index = process_block_children(node, array, index, children, context, initial_type);

    AST_ERB_END_NODE_T* end_node = NULL;

    if (index < array->size) {
      AST_NODE_T* potential_close = hb_array_get(array, index);

      if (potential_close && potential_close->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* close_erb = (AST_ERB_CONTENT_NODE_T*) potential_close;
        control_type_t close_type = detect_control_type(close_erb);

        if (close_type == CONTROL_TYPE_BLOCK_CLOSE || close_type == CONTROL_TYPE_END) {
          hb_array_T* end_errors = close_erb->base.errors;
          close_erb->base.errors = NULL;

          end_node = ast_erb_end_node_init(
            close_erb->tag_opening,
            close_erb->content,
            close_erb->tag_closing,
            close_erb->tag_opening->location.start,
            close_erb->tag_closing->location.end,
            end_errors
          );

          ast_node_free((AST_NODE_T*) close_erb);

          index++;
        }
      }
    }

    position_T start_position = erb_node->tag_opening->location.start;
    position_T end_position = erb_node->tag_closing->location.end;

    if (end_node) {
      end_position = end_node->base.location.end;
    } else if (children && children->size > 0) {
      AST_NODE_T* last_child = hb_array_get(children, children->size - 1);
      end_position = last_child->location.end;
    }

    hb_array_T* block_errors = erb_node->base.errors;
    erb_node->base.errors = NULL;

    AST_ERB_BLOCK_NODE_T* block_node = ast_erb_block_node_init(
      erb_node->tag_opening,
      erb_node->content,
      erb_node->tag_closing,
      children,
      end_node,
      start_position,
      end_position,
      block_errors
    );

    ast_node_free((AST_NODE_T*) erb_node);

    hb_array_append(output_array, (AST_NODE_T*) block_node);
    return index;
  }

  index = process_block_children(node, array, index, children, context, initial_type);

  AST_NODE_T* subsequent = NULL;
  AST_ERB_END_NODE_T* end_node = NULL;

  if (index < array->size) {
    AST_NODE_T* next_node = hb_array_get(array, index);

    if (next_node && next_node->type == AST_ERB_CONTENT_NODE) {
      AST_ERB_CONTENT_NODE_T* next_erb = (AST_ERB_CONTENT_NODE_T*) next_node;
      control_type_t next_type = detect_control_type(next_erb);

      if (is_subsequent_type(initial_type, next_type)) {
        index = process_subsequent_block(node, array, index, &subsequent, context, initial_type);
      }
    }
  }

  if (index < array->size) {
    AST_NODE_T* potential_end = hb_array_get(array, index);

    if (potential_end && potential_end->type == AST_ERB_CONTENT_NODE) {
      AST_ERB_CONTENT_NODE_T* end_erb = (AST_ERB_CONTENT_NODE_T*) potential_end;

      if (detect_control_type(end_erb) == CONTROL_TYPE_END) {
        hb_array_T* end_errors = end_erb->base.errors;
        end_erb->base.errors = NULL;

        end_node = ast_erb_end_node_init(
          end_erb->tag_opening,
          end_erb->content,
          end_erb->tag_closing,
          end_erb->tag_opening->location.start,
          end_erb->tag_closing->location.end,
          end_errors
        );

        ast_node_free((AST_NODE_T*) end_erb);

        index++;
      }
    }
  }

  AST_NODE_T* control_node = create_control_node(erb_node, children, subsequent, end_node, initial_type);

  if (control_node) {
    ast_node_free((AST_NODE_T*) erb_node);
    hb_array_append(output_array, control_node);
  } else {
    hb_array_free(&children);
  }

  return index;
}

static size_t process_subsequent_block(
  AST_NODE_T* node,
  hb_array_T* array,
  size_t index,
  AST_NODE_T** subsequent_out,
  analyze_ruby_context_T* context,
  control_type_t parent_type
) {
  AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) hb_array_get(array, index);
  control_type_t type = detect_control_type(erb_node);
  hb_array_T* children = hb_array_init(8);

  index++;

  index = process_block_children(node, array, index, children, context, parent_type);

  AST_NODE_T* subsequent_node = create_control_node(erb_node, children, NULL, NULL, type);

  if (subsequent_node) {
    ast_node_free((AST_NODE_T*) erb_node);
  } else {
    hb_array_free(&children);
  }

  if (index < array->size) {
    AST_NODE_T* next_node = hb_array_get(array, index);

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
  hb_array_T* array,
  size_t index,
  hb_array_T* children_array,
  analyze_ruby_context_T* context,
  control_type_t parent_type
) {
  while (index < array->size) {
    AST_NODE_T* child = hb_array_get(array, index);

    if (!child) { break; }

    if (child->type != AST_ERB_CONTENT_NODE) {
      hb_array_append(children_array, child);
      index++;
      continue;
    }

    AST_ERB_CONTENT_NODE_T* erb_content = (AST_ERB_CONTENT_NODE_T*) child;
    control_type_t child_type = detect_control_type(erb_content);

    if (is_terminator_type(parent_type, child_type)) { break; }

    if (child_type == CONTROL_TYPE_IF || child_type == CONTROL_TYPE_CASE || child_type == CONTROL_TYPE_CASE_MATCH
        || child_type == CONTROL_TYPE_BEGIN || child_type == CONTROL_TYPE_UNLESS || child_type == CONTROL_TYPE_WHILE
        || child_type == CONTROL_TYPE_UNTIL || child_type == CONTROL_TYPE_FOR || child_type == CONTROL_TYPE_BLOCK) {
      hb_array_T* temp_array = hb_array_init(1);
      size_t new_index = process_control_structure(node, array, index, temp_array, context, child_type);

      if (temp_array->size > 0) { hb_array_append(children_array, hb_array_get(temp_array, 0)); }

      hb_array_free(&temp_array);

      index = new_index;
      continue;
    }

    hb_array_append(children_array, child);
    index++;
  }

  return index;
}

hb_array_T* rewrite_node_array(AST_NODE_T* node, hb_array_T* array, analyze_ruby_context_T* context) {
  hb_array_T* new_array = hb_array_init(array->size);
  size_t index = 0;

  while (index < array->size) {
    AST_NODE_T* item = hb_array_get(array, index);

    if (!item) { break; }

    if (item->type != AST_ERB_CONTENT_NODE) {
      hb_array_append(new_array, item);
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
        AST_NODE_T* yield_node = create_control_node(erb_node, NULL, NULL, NULL, type);

        if (yield_node) {
          ast_node_free((AST_NODE_T*) erb_node);
          hb_array_append(new_array, yield_node);
        } else {
          hb_array_append(new_array, item);
        }

        index++;
        break;
      }

      default:
        hb_array_append(new_array, item);
        index++;
        break;
    }
  }

  return new_array;
}

static bool detect_invalid_erb_structures(const AST_NODE_T* node, void* data) {
  invalid_erb_context_T* context = (invalid_erb_context_T*) data;

  if (node->type == AST_HTML_ATTRIBUTE_NAME_NODE) { return false; }

  bool is_loop_node =
    (node->type == AST_ERB_WHILE_NODE || node->type == AST_ERB_UNTIL_NODE || node->type == AST_ERB_FOR_NODE
     || node->type == AST_ERB_BLOCK_NODE);

  bool is_begin_node = (node->type == AST_ERB_BEGIN_NODE);

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
      for (size_t i = 0; i < if_node->statements->size; i++) {
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
          for (size_t i = 0; i < elsif_node->statements->size; i++) {
            AST_NODE_T* statement = (AST_NODE_T*) hb_array_get(elsif_node->statements, i);

            if (statement != NULL) { herb_visit_node(statement, detect_invalid_erb_structures, context); }
          }
        }

        subsequent = elsif_node->subsequent;
      } else if (subsequent->type == AST_ERB_ELSE_NODE) {
        const AST_ERB_ELSE_NODE_T* else_node = (const AST_ERB_ELSE_NODE_T*) subsequent;

        if (else_node->statements != NULL) {
          for (size_t i = 0; i < else_node->statements->size; i++) {
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

void herb_analyze_parse_tree(AST_DOCUMENT_NODE_T* document, const char* source) {
  herb_visit_node((AST_NODE_T*) document, analyze_erb_content, NULL);

  analyze_ruby_context_T* context = malloc(sizeof(analyze_ruby_context_T));
  context->document = document;
  context->parent = NULL;
  context->ruby_context_stack = hb_array_init(8);

  herb_visit_node((AST_NODE_T*) document, transform_erb_nodes, context);

  invalid_erb_context_T* invalid_context = malloc(sizeof(invalid_erb_context_T));
  invalid_context->loop_depth = 0;
  invalid_context->rescue_depth = 0;

  herb_visit_node((AST_NODE_T*) document, detect_invalid_erb_structures, invalid_context);

  herb_analyze_parse_errors(document, source);

  herb_parser_match_html_tags_post_analyze(document);

  hb_array_free(&context->ruby_context_stack);

  free(context);
  free(invalid_context);
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

    RUBY_PARSE_ERROR_T* parse_error = ruby_parse_error_from_prism_error(error, (AST_NODE_T*) document, source, &parser);
    hb_array_append(document->base.errors, parse_error);
  }

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);
  pm_options_free(&options);
  free(extracted_ruby);
}
