#include <prism.h>
#include <stdbool.h>
#include <string.h>

#include "include/analyzed_ruby.h"

bool has_if_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_if_node;
}

bool has_elsif_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_elsif_node;
}

bool has_else_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_else_node;
}

bool has_end(analyzed_ruby_T* analyzed) {
  return analyzed->has_end;
}

bool has_block_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_block_node;
}

bool has_block_closing(analyzed_ruby_T* analyzed) {
  return analyzed->has_block_closing;
}

bool has_case_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_case_node;
}

bool has_when_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_when_node;
}

bool has_for_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_for_node;
}

bool has_while_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_while_node;
}

bool has_until_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_until_node;
}

bool has_begin_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_begin_node;
}

bool has_rescue_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_rescue_node;
}

bool has_ensure_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_ensure_node;
}

bool has_unless_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_unless_node;
}

bool has_yield_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_yield_node;
}

bool has_error_message(analyzed_ruby_T* anlayzed, const char* message) {
  for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) anlayzed->parser.error_list.head; error != NULL;
       error = (const pm_diagnostic_t*) error->node.next) {
    if (strcmp(error->message, message) == 0) { return true; }
  }

  return false;
}

bool search_if_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_IF_NODE) {
    analyzed->has_if_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_if_nodes, analyzed);
  }

  return false;
}

bool search_block_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_BLOCK_NODE) {
    analyzed->has_block_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_block_nodes, analyzed);
  }

  return false;
}

bool search_case_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_CASE_MATCH_NODE) {
    analyzed->has_case_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_case_nodes, analyzed);
  }

  return false;
}

bool search_while_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_WHILE_NODE) {
    analyzed->has_while_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_while_nodes, analyzed);
  }

  return false;
}

bool search_for_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_FOR_NODE) {
    analyzed->has_for_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_for_nodes, analyzed);
  }

  return false;
}

bool search_until_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_UNTIL_NODE) {
    analyzed->has_until_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_until_nodes, analyzed);
  }

  return false;
}

bool search_begin_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_BEGIN_NODE) {
    analyzed->has_begin_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_begin_nodes, analyzed);
  }

  return false;
}

bool search_unless_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_UNLESS_NODE) {
    analyzed->has_unless_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_unless_nodes, analyzed);
  }

  return false;
}

bool search_elsif_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'elsif', ignoring it")) {
    analyzed->has_elsif_node = true;
    return true;
  }

  return false;
}

bool search_else_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'else', ignoring it")) {
    analyzed->has_else_node = true;
    return true;
  }

  return false;
}

bool search_end_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'end', ignoring it")) {
    analyzed->has_end = true;
    return true;
  }

  return false;
}

bool search_block_closing_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected '}', ignoring it")) {
    analyzed->has_block_closing = true;
    return true;
  }

  return false;
}

bool search_when_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'when', ignoring it")) {
    analyzed->has_when_node = true;
    return true;
  }

  return false;
}

bool search_rescue_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'rescue', ignoring it")) {
    analyzed->has_rescue_node = true;
    return true;
  }

  return false;
}

bool search_ensure_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'ensure', ignoring it")) {
    analyzed->has_ensure_node = true;
    return true;
  }

  return false;
}

bool search_yield_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "Invalid yield")) {
    analyzed->has_yield_node = true;
    return true;
  }

  return false;
}
