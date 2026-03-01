#include <prism.h>
#include <stdbool.h>
#include <string.h>

#include "../include/analyze/analyzed_ruby.h"
#include "../include/util/string.h"

bool has_if_node(analyzed_ruby_T* analyzed) {
  return analyzed->if_node_count > 0;
}

bool has_elsif_node(analyzed_ruby_T* analyzed) {
  return analyzed->elsif_node_count > 0;
}

bool has_else_node(analyzed_ruby_T* analyzed) {
  return analyzed->else_node_count > 0;
}

bool has_end(analyzed_ruby_T* analyzed) {
  return analyzed->end_count > 0;
}

bool has_block_node(analyzed_ruby_T* analyzed) {
  return analyzed->block_node_count > 0;
}

bool has_block_closing(analyzed_ruby_T* analyzed) {
  return analyzed->block_closing_count > 0;
}

bool has_case_node(analyzed_ruby_T* analyzed) {
  return analyzed->case_node_count > 0;
}

bool has_case_match_node(analyzed_ruby_T* analyzed) {
  return analyzed->case_match_node_count > 0;
}

bool has_when_node(analyzed_ruby_T* analyzed) {
  return analyzed->when_node_count > 0;
}

bool has_in_node(analyzed_ruby_T* analyzed) {
  return analyzed->in_node_count > 0;
}

bool has_for_node(analyzed_ruby_T* analyzed) {
  return analyzed->for_node_count > 0;
}

bool has_while_node(analyzed_ruby_T* analyzed) {
  return analyzed->while_node_count > 0;
}

bool has_until_node(analyzed_ruby_T* analyzed) {
  return analyzed->until_node_count > 0;
}

bool has_begin_node(analyzed_ruby_T* analyzed) {
  return analyzed->begin_node_count > 0;
}

bool has_rescue_node(analyzed_ruby_T* analyzed) {
  return analyzed->rescue_node_count > 0;
}

bool has_ensure_node(analyzed_ruby_T* analyzed) {
  return analyzed->ensure_node_count > 0;
}

bool has_unless_node(analyzed_ruby_T* analyzed) {
  return analyzed->unless_node_count > 0;
}

bool has_yield_node(analyzed_ruby_T* analyzed) {
  return analyzed->yield_node_count > 0;
}

bool has_then_keyword(analyzed_ruby_T* analyzed) {
  return analyzed->then_keyword_count > 0;
}

bool has_error_message(analyzed_ruby_T* analyzed, const char* message) {
  for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) analyzed->parser.error_list.head; error != NULL;
       error = (const pm_diagnostic_t*) error->node.next) {
    if (string_equals(error->message, message)) { return true; }
  }

  return false;
}

bool search_if_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_IF_NODE) {
    const pm_if_node_t* if_node = (const pm_if_node_t*) node;

    bool has_if_keyword = if_node->if_keyword_loc.start != NULL && if_node->if_keyword_loc.end != NULL;
    bool has_end_keyword = if_node->end_keyword_loc.start != NULL && if_node->end_keyword_loc.end != NULL;

    if (has_if_keyword && has_end_keyword) { analyzed->if_node_count++; }
  }

  pm_visit_child_nodes(node, search_if_nodes, analyzed);

  return false;
}

bool is_do_block(pm_location_t opening_location) {
  size_t length = opening_location.end - opening_location.start;

  return length == 2 && opening_location.start[0] == 'd' && opening_location.start[1] == 'o';
}

bool is_brace_block(pm_location_t opening_location) {
  size_t length = opening_location.end - opening_location.start;

  return length == 1 && opening_location.start[0] == '{';
}

static bool has_location(pm_location_t location) {
  return location.start != NULL && location.end != NULL && (location.end - location.start) > 0;
}

static bool is_end_keyword(pm_location_t location) {
  if (location.start == NULL || location.end == NULL) { return false; }

  size_t length = location.end - location.start;

  return length == 3 && location.start[0] == 'e' && location.start[1] == 'n' && location.start[2] == 'd';
}

bool is_closing_brace(pm_location_t location) {
  if (location.start == NULL || location.end == NULL) { return false; }

  size_t length = location.end - location.start;

  return length == 1 && location.start[0] == '}';
}

bool has_valid_block_closing(pm_location_t opening_loc, pm_location_t closing_loc) {
  if (is_do_block(opening_loc)) {
    return is_end_keyword(closing_loc);
  } else if (is_brace_block(opening_loc)) {
    return is_closing_brace(closing_loc);
  }

  return false;
}

bool search_block_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_BLOCK_NODE) {
    pm_block_node_t* block_node = (pm_block_node_t*) node;

    bool has_opening = is_do_block(block_node->opening_loc) || is_brace_block(block_node->opening_loc);
    bool is_unclosed = !has_valid_block_closing(block_node->opening_loc, block_node->closing_loc);

    if (has_opening && is_unclosed) { analyzed->block_node_count++; }
  }

  if (node->type == PM_LAMBDA_NODE) {
    pm_lambda_node_t* lambda_node = (pm_lambda_node_t*) node;

    bool has_opening = is_do_block(lambda_node->opening_loc) || is_brace_block(lambda_node->opening_loc);
    bool is_unclosed = !has_valid_block_closing(lambda_node->opening_loc, lambda_node->closing_loc);

    if (has_opening && is_unclosed) { analyzed->block_node_count++; }
  }

  pm_visit_child_nodes(node, search_block_nodes, analyzed);

  return false;
}

bool search_case_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_CASE_NODE) { analyzed->case_node_count++; }

  pm_visit_child_nodes(node, search_case_nodes, analyzed);

  return false;
}

bool search_case_match_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_CASE_MATCH_NODE) { analyzed->case_match_node_count++; }

  pm_visit_child_nodes(node, search_case_match_nodes, analyzed);

  return false;
}

bool search_while_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_WHILE_NODE) { analyzed->while_node_count++; }

  pm_visit_child_nodes(node, search_while_nodes, analyzed);

  return false;
}

bool search_for_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_FOR_NODE) { analyzed->for_node_count++; }

  pm_visit_child_nodes(node, search_for_nodes, analyzed);

  return false;
}

bool search_until_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_UNTIL_NODE) { analyzed->until_node_count++; }

  pm_visit_child_nodes(node, search_until_nodes, analyzed);

  return false;
}

bool search_begin_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_BEGIN_NODE) { analyzed->begin_node_count++; }

  pm_visit_child_nodes(node, search_begin_nodes, analyzed);

  return false;
}

bool search_unless_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_UNLESS_NODE) {
    const pm_unless_node_t* unless_node = (const pm_unless_node_t*) node;

    bool has_if_keyword = unless_node->keyword_loc.start != NULL && unless_node->keyword_loc.end != NULL;
    bool has_end_keyword = unless_node->end_keyword_loc.start != NULL && unless_node->end_keyword_loc.end != NULL;

    if (has_if_keyword && has_end_keyword) { analyzed->unless_node_count++; }
  }

  pm_visit_child_nodes(node, search_unless_nodes, analyzed);

  return false;
}

bool search_when_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_WHEN_NODE) { analyzed->when_node_count++; }

  pm_visit_child_nodes(node, search_when_nodes, analyzed);

  return false;
}

bool search_in_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_IN_NODE) { analyzed->in_node_count++; }
  if (node->type == PM_MATCH_PREDICATE_NODE) { analyzed->in_node_count++; }

  pm_visit_child_nodes(node, search_in_nodes, analyzed);

  return false;
}

bool search_unexpected_elsif_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'elsif', ignoring it")) {
    analyzed->elsif_node_count++;
    return true;
  }

  return false;
}

bool search_unexpected_else_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'else', ignoring it")) {
    analyzed->else_node_count++;
    return true;
  }

  return false;
}

bool search_unexpected_end_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'end', ignoring it")) {
    if (has_error_message(analyzed, "unexpected '=', ignoring it")) {
      // `=end`
      return false;
    }

    analyzed->end_count++;
    return true;
  }

  return false;
}

bool search_unexpected_block_closing_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected '}', ignoring it")) {
    analyzed->block_closing_count++;
    return true;
  }

  return false;
}

bool search_unexpected_when_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'when', ignoring it")) {
    analyzed->when_node_count++;
    return true;
  }

  return false;
}

bool search_unexpected_in_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'in', ignoring it")) {
    analyzed->in_node_count++;
    return true;
  }

  return false;
}

bool search_unexpected_rescue_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'rescue', ignoring it")) {
    analyzed->rescue_node_count++;
    return true;
  }

  return false;
}

bool search_unexpected_ensure_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'ensure', ignoring it")) {
    analyzed->ensure_node_count++;
    return true;
  }

  return false;
}

bool search_yield_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_YIELD_NODE) { analyzed->yield_node_count++; }

  pm_visit_child_nodes(node, search_yield_nodes, analyzed);

  return false;
}

bool search_then_keywords(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  switch (node->type) {
    case PM_IF_NODE: {
      const pm_if_node_t* if_node = (const pm_if_node_t*) node;
      if (if_node->then_keyword_loc.start != NULL && if_node->then_keyword_loc.end != NULL) {
        analyzed->then_keyword_count++;
      }
      break;
    }

    case PM_UNLESS_NODE: {
      const pm_unless_node_t* unless_node = (const pm_unless_node_t*) node;
      if (unless_node->then_keyword_loc.start != NULL && unless_node->then_keyword_loc.end != NULL) {
        analyzed->then_keyword_count++;
      }
      break;
    }

    case PM_WHEN_NODE: {
      const pm_when_node_t* when_node = (const pm_when_node_t*) node;
      if (when_node->then_keyword_loc.start != NULL && when_node->then_keyword_loc.end != NULL) {
        analyzed->then_keyword_count++;
      }
      break;
    }

    default: break;
  }

  pm_visit_child_nodes(node, search_then_keywords, analyzed);

  return false;
}

static bool is_postfix_conditional(const pm_statements_node_t* statements, pm_location_t keyword_location) {
  if (statements == NULL) { return false; }

  return statements->base.location.start < keyword_location.start;
}

bool search_unclosed_control_flows(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (analyzed->unclosed_control_flow_count >= 2) { return false; }

  switch (node->type) {
    case PM_IF_NODE: {
      const pm_if_node_t* if_node = (const pm_if_node_t*) node;

      if (has_location(if_node->if_keyword_loc) && !is_end_keyword(if_node->end_keyword_loc)) {
        if (!is_postfix_conditional(if_node->statements, if_node->if_keyword_loc)) {
          analyzed->unclosed_control_flow_count++;
        }
      }

      break;
    }

    case PM_UNLESS_NODE: {
      const pm_unless_node_t* unless_node = (const pm_unless_node_t*) node;

      if (has_location(unless_node->keyword_loc) && !is_end_keyword(unless_node->end_keyword_loc)) {
        if (!is_postfix_conditional(unless_node->statements, unless_node->keyword_loc)) {
          analyzed->unclosed_control_flow_count++;
        }
      }

      break;
    }

    case PM_CASE_NODE: {
      const pm_case_node_t* case_node = (const pm_case_node_t*) node;

      if (has_location(case_node->case_keyword_loc) && !is_end_keyword(case_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_CASE_MATCH_NODE: {
      const pm_case_match_node_t* case_match_node = (const pm_case_match_node_t*) node;

      if (has_location(case_match_node->case_keyword_loc) && !is_end_keyword(case_match_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_WHILE_NODE: {
      const pm_while_node_t* while_node = (const pm_while_node_t*) node;

      if (has_location(while_node->keyword_loc) && !is_end_keyword(while_node->closing_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_UNTIL_NODE: {
      const pm_until_node_t* until_node = (const pm_until_node_t*) node;

      if (has_location(until_node->keyword_loc) && !is_end_keyword(until_node->closing_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_FOR_NODE: {
      const pm_for_node_t* for_node = (const pm_for_node_t*) node;

      if (has_location(for_node->for_keyword_loc) && !is_end_keyword(for_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_BEGIN_NODE: {
      const pm_begin_node_t* begin_node = (const pm_begin_node_t*) node;

      if (has_location(begin_node->begin_keyword_loc) && !is_end_keyword(begin_node->end_keyword_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_BLOCK_NODE: {
      const pm_block_node_t* block_node = (const pm_block_node_t*) node;
      bool has_opening = is_do_block(block_node->opening_loc) || is_brace_block(block_node->opening_loc);

      if (has_opening && !has_valid_block_closing(block_node->opening_loc, block_node->closing_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    case PM_LAMBDA_NODE: {
      const pm_lambda_node_t* lambda_node = (const pm_lambda_node_t*) node;
      bool has_opening = is_do_block(lambda_node->opening_loc) || is_brace_block(lambda_node->opening_loc);

      if (has_opening && !has_valid_block_closing(lambda_node->opening_loc, lambda_node->closing_loc)) {
        analyzed->unclosed_control_flow_count++;
      }

      break;
    }

    default: break;
  }

  pm_visit_child_nodes(node, search_unclosed_control_flows, analyzed);

  return false;
}
