#include "../include/analyze/control_type.h"
#include "../include/analyze/analyze.h"
#include "../include/analyze/analyzed_ruby.h"
#include "../include/analyze/helpers.h"
#include "../include/ast_node.h"

#include <prism.h>
#include <stdbool.h>
#include <stdint.h>

typedef struct {
  control_type_t type;
  uint32_t offset;
  bool found;
} earliest_control_keyword_T;

typedef struct {
  earliest_control_keyword_T* result;
  const uint8_t* source_start;
} location_walker_context_T;

static bool control_type_is_block(control_type_t type) {
  return type == CONTROL_TYPE_BLOCK;
}

static bool control_type_is_yield(control_type_t type) {
  return type == CONTROL_TYPE_YIELD;
}

static bool find_earliest_control_keyword_walker(const pm_node_t* node, void* data) {
  if (!node) { return true; }

  location_walker_context_T* context = (location_walker_context_T*) data;
  earliest_control_keyword_T* result = context->result;

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

      if (call->block != NULL && call->block->type == PM_BLOCK_NODE) {
        pm_block_node_t* block_node = (pm_block_node_t*) call->block;

        bool has_do_opening = is_do_block(block_node->opening_loc);
        bool has_brace_opening = is_brace_block(block_node->opening_loc);
        bool has_valid_brace_closing = is_closing_brace(block_node->closing_loc);

        if (has_do_opening || (has_brace_opening && !has_valid_brace_closing)) {
          current_type = CONTROL_TYPE_BLOCK;
          keyword_offset = (uint32_t) (node->location.start - context->source_start);
        }
      }
      break;
    }

    case PM_LAMBDA_NODE: {
      pm_lambda_node_t* lambda = (pm_lambda_node_t*) node;

      bool has_do_opening = is_do_block(lambda->opening_loc);
      bool has_brace_opening = is_brace_block(lambda->opening_loc);
      bool has_valid_brace_closing = is_closing_brace(lambda->closing_loc);

      if (has_do_opening || (has_brace_opening && !has_valid_brace_closing)) {
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
    bool should_update = !result->found;

    if (result->found) {
      if (control_type_is_block(current_type) && control_type_is_yield(result->type)) {
        should_update = true;
      } else if (!(control_type_is_yield(current_type) && control_type_is_block(result->type))) {
        should_update = keyword_offset < result->offset;
      }
    }

    if (should_update) {
      result->type = current_type;
      result->offset = keyword_offset;
      result->found = true;
    }
  }

  return true;
}

static control_type_t find_earliest_control_keyword(pm_node_t* root, const uint8_t* source_start) {
  if (!root) { return CONTROL_TYPE_UNKNOWN; }

  earliest_control_keyword_T result = { .type = CONTROL_TYPE_UNKNOWN, .offset = UINT32_MAX, .found = false };

  location_walker_context_T context = { .result = &result, .source_start = source_start };

  pm_visit_node(root, find_earliest_control_keyword_walker, &context);

  return result.found ? result.type : CONTROL_TYPE_UNKNOWN;
}

control_type_t detect_control_type(AST_ERB_CONTENT_NODE_T* erb_node) {
  if (!erb_node || erb_node->base.type != AST_ERB_CONTENT_NODE) { return CONTROL_TYPE_UNKNOWN; }
  if (erb_node->tag_closing == NULL) { return CONTROL_TYPE_UNKNOWN; }

  analyzed_ruby_T* ruby = erb_node->analyzed_ruby;

  if (!ruby) { return CONTROL_TYPE_UNKNOWN; }
  if (ruby->valid) { return CONTROL_TYPE_UNKNOWN; }

  pm_node_t* root = ruby->root;

  if (has_elsif_node(ruby)) { return CONTROL_TYPE_ELSIF; }
  if (has_else_node(ruby)) { return CONTROL_TYPE_ELSE; }
  if (has_end(ruby)) { return CONTROL_TYPE_END; }
  if (has_when_node(ruby) && !has_case_node(ruby)) { return CONTROL_TYPE_WHEN; }
  if (has_in_node(ruby) && !has_case_match_node(ruby)) { return CONTROL_TYPE_IN; }
  if (has_rescue_node(ruby)) { return CONTROL_TYPE_RESCUE; }
  if (has_ensure_node(ruby)) { return CONTROL_TYPE_ENSURE; }
  if (has_block_closing(ruby)) { return CONTROL_TYPE_BLOCK_CLOSE; }

  if (ruby->unclosed_control_flow_count == 0 && !has_yield_node(ruby)) { return CONTROL_TYPE_UNKNOWN; }

  return find_earliest_control_keyword(root, ruby->parser.start);
}

bool is_subsequent_type(control_type_t parent_type, control_type_t child_type) {
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

bool is_terminator_type(control_type_t parent_type, control_type_t child_type) {
  if (child_type == CONTROL_TYPE_END) { return true; }

  switch (parent_type) {
    case CONTROL_TYPE_WHEN: return child_type == CONTROL_TYPE_WHEN || child_type == CONTROL_TYPE_ELSE;
    case CONTROL_TYPE_IN: return child_type == CONTROL_TYPE_IN || child_type == CONTROL_TYPE_ELSE;
    case CONTROL_TYPE_BLOCK: return child_type == CONTROL_TYPE_BLOCK_CLOSE;

    default: return is_subsequent_type(parent_type, child_type);
  }
}

bool is_compound_control_type(control_type_t type) {
  switch (type) {
    case CONTROL_TYPE_IF:
    case CONTROL_TYPE_CASE:
    case CONTROL_TYPE_CASE_MATCH:
    case CONTROL_TYPE_BEGIN:
    case CONTROL_TYPE_UNLESS:
    case CONTROL_TYPE_WHILE:
    case CONTROL_TYPE_UNTIL:
    case CONTROL_TYPE_FOR:
    case CONTROL_TYPE_BLOCK: return true;

    default: return false;
  }
}
