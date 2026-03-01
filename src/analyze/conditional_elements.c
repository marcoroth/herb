#include "../include/analyze/conditional_elements.h"
#include "../include/ast_nodes.h"
#include "../include/element_source.h"
#include "../include/errors.h"
#include "../include/token_struct.h"
#include "../include/util.h"
#include "../include/util/hb_array.h"
#include "../include/util/hb_buffer.h"
#include "../include/util/hb_string.h"
#include "../include/util/string.h"
#include "../include/visitor.h"

#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

static const char* extract_condition_from_erb_content(AST_NODE_T* erb_node, bool* is_if) {
  if (!erb_node) { return NULL; }

  token_T* content_token = NULL;

  if (erb_node->type == AST_ERB_IF_NODE) {
    AST_ERB_IF_NODE_T* if_node = (AST_ERB_IF_NODE_T*) erb_node;
    content_token = if_node->content;
    *is_if = true;
  } else if (erb_node->type == AST_ERB_UNLESS_NODE) {
    AST_ERB_UNLESS_NODE_T* unless_node = (AST_ERB_UNLESS_NODE_T*) erb_node;
    content_token = unless_node->content;
    *is_if = false;
  } else {
    return NULL;
  }

  if (!content_token || !content_token->value) { return NULL; }

  const char* content = content_token->value;

  content = skip_whitespace(content);

  if (*is_if) {
    if (strncmp(content, "if", 2) == 0 && is_whitespace(content[2])) { content += 3; }
  } else {
    if (strncmp(content, "unless", 6) == 0 && is_whitespace(content[6])) { content += 7; }
  }

  content = skip_whitespace(content);

  if (strlen(content) == 0) { return NULL; }

  size_t length = strlen(content);

  while (length > 0 && is_whitespace(content[length - 1])) {
    length--;
  }

  hb_buffer_T buffer;
  hb_buffer_init(&buffer, length + 1);
  hb_buffer_append_with_length(&buffer, content, length);

  return buffer.value;
}

static bool is_simple_erb_conditional(AST_NODE_T* node) {
  if (node->type == AST_ERB_IF_NODE) {
    AST_ERB_IF_NODE_T* if_node = (AST_ERB_IF_NODE_T*) node;
    return if_node->subsequent == NULL;
  } else if (node->type == AST_ERB_UNLESS_NODE) {
    AST_ERB_UNLESS_NODE_T* unless_node = (AST_ERB_UNLESS_NODE_T*) node;
    return unless_node->else_clause == NULL;
  }

  return false;
}

static hb_array_T* get_erb_conditional_statements(AST_NODE_T* node) {
  if (node->type == AST_ERB_IF_NODE) {
    return ((AST_ERB_IF_NODE_T*) node)->statements;
  } else if (node->type == AST_ERB_UNLESS_NODE) {
    return ((AST_ERB_UNLESS_NODE_T*) node)->statements;
  }

  return NULL;
}

static bool contains_single_open_tag(hb_array_T* statements, AST_HTML_OPEN_TAG_NODE_T** out_tag) {
  if (!statements || hb_array_size(statements) == 0) { return false; }

  *out_tag = NULL;
  size_t tag_count = 0;

  for (size_t statement_index = 0; statement_index < hb_array_size(statements); statement_index++) {
    AST_NODE_T* child = (AST_NODE_T*) hb_array_get(statements, statement_index);

    if (!child) { continue; }
    if (child->type == AST_WHITESPACE_NODE) { continue; }

    if (child->type == AST_HTML_TEXT_NODE) {
      AST_HTML_TEXT_NODE_T* text = (AST_HTML_TEXT_NODE_T*) child;
      bool whitespace_only = true;

      if (text->content) {
        for (const char* character = text->content; *character; character++) {
          if (!is_whitespace(*character)) {
            whitespace_only = false;
            break;
          }
        }
      }

      if (whitespace_only) { continue; }

      return false;
    }

    if (child->type == AST_HTML_OPEN_TAG_NODE) {
      AST_HTML_OPEN_TAG_NODE_T* open_tag = (AST_HTML_OPEN_TAG_NODE_T*) child;

      if (open_tag->is_void) { return false; }

      *out_tag = open_tag;
      tag_count++;

      if (tag_count > 1) { return false; }

      continue;
    }

    return false;
  }

  return tag_count == 1;
}

static bool contains_single_close_tag(hb_array_T* statements, AST_HTML_CLOSE_TAG_NODE_T** out_tag) {
  if (!statements || hb_array_size(statements) == 0) { return false; }

  *out_tag = NULL;
  size_t tag_count = 0;

  for (size_t statement_index = 0; statement_index < hb_array_size(statements); statement_index++) {
    AST_NODE_T* child = (AST_NODE_T*) hb_array_get(statements, statement_index);
    if (!child) { continue; }

    if (child->type == AST_WHITESPACE_NODE) { continue; }

    if (child->type == AST_HTML_TEXT_NODE) {
      AST_HTML_TEXT_NODE_T* text = (AST_HTML_TEXT_NODE_T*) child;
      bool whitespace_only = true;

      if (text->content) {
        for (const char* character = text->content; *character; character++) {
          if (!is_whitespace(*character)) {
            whitespace_only = false;
            break;
          }
        }
      }

      if (whitespace_only) { continue; }

      return false;
    }

    if (child->type == AST_HTML_CLOSE_TAG_NODE) {
      *out_tag = (AST_HTML_CLOSE_TAG_NODE_T*) child;
      tag_count++;

      if (tag_count > 1) { return false; }

      continue;
    }

    return false;
  }

  return tag_count == 1;
}

static size_t count_nodes_of_type(hb_array_T* array, ast_node_type_T type) {
  if (!array || hb_array_size(array) == 0) { return 0; }

  size_t count = 0;

  for (size_t index = 0; index < hb_array_size(array); index++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(array, index);
    if (!node) { continue; }

    if (node->type == type) {
      if (type == AST_HTML_OPEN_TAG_NODE) {
        AST_HTML_OPEN_TAG_NODE_T* open_tag = (AST_HTML_OPEN_TAG_NODE_T*) node;
        if (!open_tag->is_void) { count++; }
      } else {
        count++;
      }
    }
  }

  return count;
}

static bool conditions_are_equivalent(const char* a, const char* b) {
  if (!a || !b) { return false; }

  return string_equals(a, b);
}

typedef struct {
  size_t open_index;
  AST_NODE_T* open_conditional;
  AST_HTML_OPEN_TAG_NODE_T* open_tag;
  const char* tag_name;
  const char* condition;
  bool is_if;
} conditional_open_tag_T;

static void rewrite_conditional_elements(hb_array_T* nodes, hb_array_T* document_errors) {
  if (!nodes || hb_array_size(nodes) == 0) { return; }
  if (!document_errors) { return; }

  for (size_t open_index = 0; open_index < hb_array_size(nodes); open_index++) {
    AST_NODE_T* open_node = (AST_NODE_T*) hb_array_get(nodes, open_index);

    if (!open_node) { continue; }
    if (open_node->type != AST_ERB_IF_NODE && open_node->type != AST_ERB_UNLESS_NODE) { continue; }
    if (!is_simple_erb_conditional(open_node)) { continue; }

    hb_array_T* open_statements = get_erb_conditional_statements(open_node);

    size_t open_tag_count = count_nodes_of_type(open_statements, AST_HTML_OPEN_TAG_NODE);
    if (open_tag_count < 2) { continue; }

    size_t open_close_tag_count = count_nodes_of_type(open_statements, AST_HTML_CLOSE_TAG_NODE);
    if (open_tag_count <= open_close_tag_count) { continue; }

    bool open_is_if;
    const char* open_condition = extract_condition_from_erb_content(open_node, &open_is_if);

    if (!open_condition) { continue; }

    for (size_t close_index = open_index + 1; close_index < hb_array_size(nodes); close_index++) {
      AST_NODE_T* close_node = (AST_NODE_T*) hb_array_get(nodes, close_index);

      if (!close_node) { continue; }
      if (close_node->type != AST_ERB_IF_NODE && close_node->type != AST_ERB_UNLESS_NODE) { continue; }
      if (!is_simple_erb_conditional(close_node)) { continue; }

      hb_array_T* close_statements = get_erb_conditional_statements(close_node);

      size_t close_tag_count = count_nodes_of_type(close_statements, AST_HTML_CLOSE_TAG_NODE);
      if (close_tag_count < 2) { continue; }

      size_t close_open_tag_count = count_nodes_of_type(close_statements, AST_HTML_OPEN_TAG_NODE);
      if (close_tag_count <= close_open_tag_count) { continue; }

      bool close_is_if;
      const char* close_condition = extract_condition_from_erb_content(close_node, &close_is_if);

      if (!close_condition) { continue; }

      if (open_is_if == close_is_if && conditions_are_equivalent(open_condition, close_condition)) {
        CONDITIONAL_ELEMENT_MULTIPLE_TAGS_ERROR_T* multiple_tags_error = conditional_element_multiple_tags_error_init(
          open_node->location.start.line,
          open_node->location.start.column,
          open_node->location.start,
          open_node->location.end
        );

        hb_array_append(document_errors, multiple_tags_error);

        free((void*) close_condition);
        break;
      }

      free((void*) close_condition);
    }

    free((void*) open_condition);
  }

  hb_array_T* open_stack = hb_array_init(8);

  for (size_t node_index = 0; node_index < hb_array_size(nodes); node_index++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(nodes, node_index);

    if (!node) { continue; }
    if (node->type != AST_ERB_IF_NODE && node->type != AST_ERB_UNLESS_NODE) { continue; }
    if (!is_simple_erb_conditional(node)) { continue; }

    hb_array_T* statements = get_erb_conditional_statements(node);
    AST_HTML_OPEN_TAG_NODE_T* open_tag = NULL;

    if (contains_single_open_tag(statements, &open_tag)) {
      conditional_open_tag_T* entry = malloc(sizeof(conditional_open_tag_T));

      if (!entry) { continue; }

      entry->open_index = node_index;
      entry->open_conditional = node;
      entry->open_tag = open_tag;
      entry->tag_name = open_tag->tag_name->value;

      bool is_if;
      entry->condition = extract_condition_from_erb_content(node, &is_if);
      entry->is_if = is_if;

      hb_array_append(open_stack, entry);
    }
  }

  hb_array_T* consumed_indices = hb_array_init(8);

  for (size_t node_index = 0; node_index < hb_array_size(nodes); node_index++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(nodes, node_index);

    if (!node) { continue; }
    if (node->type != AST_ERB_IF_NODE && node->type != AST_ERB_UNLESS_NODE) { continue; }
    if (!is_simple_erb_conditional(node)) { continue; }

    hb_array_T* statements = get_erb_conditional_statements(node);
    AST_HTML_CLOSE_TAG_NODE_T* close_tag = NULL;

    if (!contains_single_close_tag(statements, &close_tag)) { continue; }

    conditional_open_tag_T* matched_open = NULL;
    size_t matched_stack_index = (size_t) -1;

    conditional_open_tag_T* mismatched_open = NULL;
    const char* mismatched_close_condition = NULL;

    for (size_t stack_index = hb_array_size(open_stack); stack_index > 0; stack_index--) {
      conditional_open_tag_T* entry = (conditional_open_tag_T*) hb_array_get(open_stack, stack_index - 1);

      if (!entry) { continue; }
      if (!hb_string_equals_case_insensitive(hb_string(entry->tag_name), hb_string(close_tag->tag_name->value))) {
        continue;
      }

      bool close_is_if;
      const char* close_condition = extract_condition_from_erb_content(node, &close_is_if);

      if (entry->is_if != close_is_if) {
        if (close_condition) { free((void*) close_condition); }

        continue;
      }

      if (!conditions_are_equivalent(entry->condition, close_condition)) {
        if (!mismatched_open && entry->open_index < node_index) {
          mismatched_open = entry;
          mismatched_close_condition = close_condition;
        } else {
          if (close_condition) { free((void*) close_condition); }
        }

        continue;
      }

      if (mismatched_close_condition) {
        free((void*) mismatched_close_condition);
        mismatched_close_condition = NULL;
        mismatched_open = NULL;
      }

      if (close_condition) { free((void*) close_condition); }

      if (entry->open_index >= node_index) { continue; }

      matched_open = entry;
      matched_stack_index = stack_index - 1;

      break;
    }

    if (!matched_open && mismatched_open && mismatched_close_condition) {
      CONDITIONAL_ELEMENT_CONDITION_MISMATCH_ERROR_T* mismatch_error =
        conditional_element_condition_mismatch_error_init(
          mismatched_open->tag_name,
          mismatched_open->condition,
          mismatched_open->open_conditional->location.start.line,
          mismatched_open->open_conditional->location.start.column,
          mismatched_close_condition,
          node->location.start.line,
          node->location.start.column,
          mismatched_open->open_conditional->location.start,
          node->location.end
        );

      hb_array_append(document_errors, mismatch_error);
      free((void*) mismatched_close_condition);
      continue;
    }

    if (mismatched_close_condition) { free((void*) mismatched_close_condition); }

    if (!matched_open) { continue; }

    hb_array_T* body = hb_array_init(8);

    for (size_t body_index = matched_open->open_index + 1; body_index < node_index; body_index++) {
      AST_NODE_T* body_node = (AST_NODE_T*) hb_array_get(nodes, body_index);

      if (body_node) { hb_array_append(body, body_node); }
    }

    position_T start_position = matched_open->open_conditional->location.start;
    position_T end_position = node->location.end;
    hb_array_T* errors = hb_array_init(8);
    char* condition_copy = hb_string_to_c_string_using_malloc(hb_string(matched_open->condition));

    AST_HTML_CONDITIONAL_ELEMENT_NODE_T* conditional_element = ast_html_conditional_element_node_init(
      condition_copy,
      matched_open->open_conditional,
      matched_open->open_tag,
      body,
      (AST_NODE_T*) close_tag,
      node,
      matched_open->open_tag->tag_name,
      ELEMENT_SOURCE_HTML,
      start_position,
      end_position,
      errors
    );

    free(condition_copy);

    for (size_t body_index = matched_open->open_index + 1; body_index < node_index; body_index++) {
      size_t* consumed_index = malloc(sizeof(size_t));

      if (consumed_index) {
        *consumed_index = body_index;
        hb_array_append(consumed_indices, consumed_index);
      }

      hb_array_set(nodes, body_index, NULL);
    }

    hb_array_set(nodes, matched_open->open_index, conditional_element);

    size_t* close_index = malloc(sizeof(size_t));

    if (close_index) {
      *close_index = node_index;
      hb_array_append(consumed_indices, close_index);
    }
    hb_array_set(nodes, node_index, NULL);

    if (matched_open->condition) { free((void*) matched_open->condition); }

    free(matched_open);
    hb_array_set(open_stack, matched_stack_index, NULL);
  }

  for (size_t stack_index = 0; stack_index < hb_array_size(open_stack); stack_index++) {
    conditional_open_tag_T* entry = (conditional_open_tag_T*) hb_array_get(open_stack, stack_index);

    if (entry) {
      if (entry->condition) { free((void*) entry->condition); }

      free(entry);
    }
  }

  hb_array_free(&open_stack);

  if (hb_array_size(consumed_indices) > 0) {
    hb_array_T* new_nodes = hb_array_init(hb_array_size(nodes));

    for (size_t node_index = 0; node_index < hb_array_size(nodes); node_index++) {
      bool consumed = false;

      for (size_t consumed_index = 0; consumed_index < hb_array_size(consumed_indices); consumed_index++) {
        size_t* stored_index = (size_t*) hb_array_get(consumed_indices, consumed_index);

        if (stored_index && *stored_index == node_index) {
          consumed = true;
          break;
        }
      }

      if (!consumed) {
        AST_NODE_T* node = (AST_NODE_T*) hb_array_get(nodes, node_index);
        if (node) { hb_array_append(new_nodes, node); }
      }
    }

    nodes->size = 0;

    for (size_t new_index = 0; new_index < hb_array_size(new_nodes); new_index++) {
      hb_array_append(nodes, hb_array_get(new_nodes, new_index));
    }

    hb_array_free(&new_nodes);
  }

  for (size_t i = 0; i < hb_array_size(consumed_indices); i++) {
    size_t* index = (size_t*) hb_array_get(consumed_indices, i);

    if (index) { free(index); }
  }

  hb_array_free(&consumed_indices);
}

static bool transform_conditional_elements_visitor(const AST_NODE_T* node, void* data);

static void transform_conditional_elements_in_array(hb_array_T* array, hb_array_T* document_errors) {
  if (!array) { return; }

  for (size_t i = 0; i < hb_array_size(array); i++) {
    AST_NODE_T* child = (AST_NODE_T*) hb_array_get(array, i);

    if (child) { herb_visit_node(child, transform_conditional_elements_visitor, document_errors); }
  }

  rewrite_conditional_elements(array, document_errors);
}

static bool transform_conditional_elements_visitor(const AST_NODE_T* node, void* data) {
  if (!node) { return false; }

  hb_array_T* document_errors = (hb_array_T*) data;

  switch (node->type) {
    case AST_DOCUMENT_NODE: {
      AST_DOCUMENT_NODE_T* doc = (AST_DOCUMENT_NODE_T*) node;
      transform_conditional_elements_in_array(doc->children, document_errors);
      return false;
    }

    case AST_HTML_ELEMENT_NODE: {
      AST_HTML_ELEMENT_NODE_T* element = (AST_HTML_ELEMENT_NODE_T*) node;
      transform_conditional_elements_in_array(element->body, document_errors);
      return false;
    }

    case AST_ERB_IF_NODE: {
      AST_ERB_IF_NODE_T* if_node = (AST_ERB_IF_NODE_T*) node;
      transform_conditional_elements_in_array(if_node->statements, document_errors);

      if (if_node->subsequent) { herb_visit_node(if_node->subsequent, transform_conditional_elements_visitor, data); }

      return false;
    }

    case AST_ERB_ELSE_NODE: {
      AST_ERB_ELSE_NODE_T* else_node = (AST_ERB_ELSE_NODE_T*) node;
      transform_conditional_elements_in_array(else_node->statements, document_errors);
      return false;
    }

    case AST_ERB_UNLESS_NODE: {
      AST_ERB_UNLESS_NODE_T* unless_node = (AST_ERB_UNLESS_NODE_T*) node;
      transform_conditional_elements_in_array(unless_node->statements, document_errors);

      if (unless_node->else_clause) {
        herb_visit_node((AST_NODE_T*) unless_node->else_clause, transform_conditional_elements_visitor, data);
      }

      return false;
    }

    case AST_ERB_BLOCK_NODE: {
      AST_ERB_BLOCK_NODE_T* block_node = (AST_ERB_BLOCK_NODE_T*) node;
      transform_conditional_elements_in_array(block_node->body, document_errors);
      return false;
    }

    case AST_ERB_WHILE_NODE: {
      AST_ERB_WHILE_NODE_T* while_node = (AST_ERB_WHILE_NODE_T*) node;
      transform_conditional_elements_in_array(while_node->statements, document_errors);
      return false;
    }

    case AST_ERB_UNTIL_NODE: {
      AST_ERB_UNTIL_NODE_T* until_node = (AST_ERB_UNTIL_NODE_T*) node;
      transform_conditional_elements_in_array(until_node->statements, document_errors);
      return false;
    }

    case AST_ERB_FOR_NODE: {
      AST_ERB_FOR_NODE_T* for_node = (AST_ERB_FOR_NODE_T*) node;
      transform_conditional_elements_in_array(for_node->statements, document_errors);
      return false;
    }

    case AST_ERB_CASE_NODE: {
      AST_ERB_CASE_NODE_T* case_node = (AST_ERB_CASE_NODE_T*) node;
      transform_conditional_elements_in_array(case_node->children, document_errors);

      for (size_t i = 0; i < hb_array_size(case_node->conditions); i++) {
        AST_NODE_T* when = (AST_NODE_T*) hb_array_get(case_node->conditions, i);
        if (when) { herb_visit_node(when, transform_conditional_elements_visitor, data); }
      }

      if (case_node->else_clause) {
        herb_visit_node((AST_NODE_T*) case_node->else_clause, transform_conditional_elements_visitor, data);
      }

      return false;
    }

    case AST_ERB_WHEN_NODE: {
      AST_ERB_WHEN_NODE_T* when_node = (AST_ERB_WHEN_NODE_T*) node;
      transform_conditional_elements_in_array(when_node->statements, document_errors);
      return false;
    }

    case AST_ERB_BEGIN_NODE: {
      AST_ERB_BEGIN_NODE_T* begin_node = (AST_ERB_BEGIN_NODE_T*) node;
      transform_conditional_elements_in_array(begin_node->statements, document_errors);

      if (begin_node->rescue_clause) {
        herb_visit_node((AST_NODE_T*) begin_node->rescue_clause, transform_conditional_elements_visitor, data);
      }

      if (begin_node->else_clause) {
        herb_visit_node((AST_NODE_T*) begin_node->else_clause, transform_conditional_elements_visitor, data);
      }

      if (begin_node->ensure_clause) {
        herb_visit_node((AST_NODE_T*) begin_node->ensure_clause, transform_conditional_elements_visitor, data);
      }

      return false;
    }

    case AST_ERB_RESCUE_NODE: {
      AST_ERB_RESCUE_NODE_T* rescue_node = (AST_ERB_RESCUE_NODE_T*) node;
      transform_conditional_elements_in_array(rescue_node->statements, document_errors);

      if (rescue_node->subsequent) {
        herb_visit_node((AST_NODE_T*) rescue_node->subsequent, transform_conditional_elements_visitor, data);
      }

      return false;
    }

    case AST_ERB_ENSURE_NODE: {
      AST_ERB_ENSURE_NODE_T* ensure_node = (AST_ERB_ENSURE_NODE_T*) node;
      transform_conditional_elements_in_array(ensure_node->statements, document_errors);
      return false;
    }

    default: return true;
  }
}

void herb_transform_conditional_elements(AST_DOCUMENT_NODE_T* document) {
  herb_visit_node((AST_NODE_T*) document, transform_conditional_elements_visitor, document->base.errors);
}
