#include "../include/analyze/conditional_open_tags.h"
#include "../include/ast_nodes.h"
#include "../include/element_source.h"
#include "../include/errors.h"
#include "../include/token_struct.h"
#include "../include/util.h"
#include "../include/util/hb_array.h"
#include "../include/util/hb_string.h"
#include "../include/visitor.h"

#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

static bool transform_conditional_open_tags_visitor(const AST_NODE_T* node, void* data);
static void transform_conditional_open_tags_in_array(hb_array_T* array, hb_array_T* document_errors);

static bool is_non_void_open_tag(AST_NODE_T* node) {
  if (!node || node->type != AST_HTML_OPEN_TAG_NODE) { return false; }

  AST_HTML_OPEN_TAG_NODE_T* open_tag = (AST_HTML_OPEN_TAG_NODE_T*) node;

  return !open_tag->is_void;
}

static const char* get_open_tag_name(AST_HTML_OPEN_TAG_NODE_T* open_tag) {
  if (!open_tag || !open_tag->tag_name) { return NULL; }

  return open_tag->tag_name->value;
}

typedef struct {
  AST_HTML_OPEN_TAG_NODE_T* tag;
  AST_HTML_OPEN_TAG_NODE_T* second_tag;
  bool has_multiple_tags;
} single_open_tag_result_T;

static bool has_matching_close_tag_in_statements(hb_array_T* statements, size_t open_tag_index, const char* tag_name) {
  if (!statements || !tag_name) { return false; }

  int depth = 0;

  for (size_t i = open_tag_index + 1; i < hb_array_size(statements); i++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(statements, i);

    if (!node) { continue; }

    if (node->type == AST_HTML_OPEN_TAG_NODE) {
      AST_HTML_OPEN_TAG_NODE_T* open_tag = (AST_HTML_OPEN_TAG_NODE_T*) node;

      if (open_tag->tag_name && open_tag->tag_name->value) {
        if (hb_string_equals_case_insensitive(hb_string(tag_name), hb_string(open_tag->tag_name->value))) { depth++; }
      }
    } else if (node->type == AST_HTML_CLOSE_TAG_NODE) {
      AST_HTML_CLOSE_TAG_NODE_T* close_tag = (AST_HTML_CLOSE_TAG_NODE_T*) node;

      if (close_tag->tag_name && close_tag->tag_name->value) {
        if (hb_string_equals_case_insensitive(hb_string(tag_name), hb_string(close_tag->tag_name->value))) {
          if (depth == 0) { return true; }
          depth--;
        }
      }
    }
  }

  return false;
}

static single_open_tag_result_T get_single_open_tag_from_statements(hb_array_T* statements) {
  single_open_tag_result_T result = { .tag = NULL, .second_tag = NULL, .has_multiple_tags = false };

  if (!statements || hb_array_size(statements) == 0) { return result; }

  size_t tag_count = 0;
  size_t first_tag_index = 0;

  for (size_t i = 0; i < hb_array_size(statements); i++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(statements, i);

    if (!node) { continue; }

    if (node->type == AST_HTML_TEXT_NODE) {
      AST_HTML_TEXT_NODE_T* text = (AST_HTML_TEXT_NODE_T*) node;
      bool whitespace_only = true;

      if (text->content) {
        for (const char* c = text->content; *c; c++) {
          if (!is_whitespace(*c)) {
            whitespace_only = false;
            break;
          }
        }
      }

      if (whitespace_only) { continue; }

      if (result.tag) {
        const char* tag_name = get_open_tag_name(result.tag);

        if (tag_name && has_matching_close_tag_in_statements(statements, first_tag_index, tag_name)) {
          result.tag = NULL;
          result.has_multiple_tags = false;
          result.second_tag = NULL;
        }
      }
      return result;
    }

    if (is_non_void_open_tag(node)) {
      tag_count++;

      if (tag_count == 1) {
        result.tag = (AST_HTML_OPEN_TAG_NODE_T*) node;
        first_tag_index = i;
      } else if (tag_count == 2) {
        result.second_tag = (AST_HTML_OPEN_TAG_NODE_T*) node;
        result.has_multiple_tags = true;
      }

      continue;
    }
  }

  if (tag_count != 1) {
    result.tag = NULL;

    if (result.has_multiple_tags && result.second_tag) {
      const char* first_tag_name =
        get_open_tag_name((AST_HTML_OPEN_TAG_NODE_T*) hb_array_get(statements, first_tag_index));
      bool first_has_close =
        first_tag_name && has_matching_close_tag_in_statements(statements, first_tag_index, first_tag_name);

      if (first_has_close) {
        result.has_multiple_tags = false;
        result.second_tag = NULL;
      }
    }
  }

  if (result.tag) {
    const char* tag_name = get_open_tag_name(result.tag);

    if (tag_name && has_matching_close_tag_in_statements(statements, first_tag_index, tag_name)) { result.tag = NULL; }
  }

  return result;
}

static const char* check_erb_if_conditional_open_tag(AST_ERB_IF_NODE_T* if_node) {
  if (!if_node) { return NULL; }

  if (!if_node->subsequent) { return NULL; }

  single_open_tag_result_T if_result = get_single_open_tag_from_statements(if_node->statements);
  if (!if_result.tag) { return NULL; }

  const char* common_tag_name = get_open_tag_name(if_result.tag);
  if (!common_tag_name) { return NULL; }

  AST_NODE_T* current = if_node->subsequent;
  bool ends_with_else = false;

  while (current) {
    hb_array_T* branch_statements = NULL;
    AST_NODE_T* next_subsequent = NULL;

    if (current->type == AST_ERB_IF_NODE) {
      AST_ERB_IF_NODE_T* elsif_node = (AST_ERB_IF_NODE_T*) current;
      branch_statements = elsif_node->statements;
      next_subsequent = elsif_node->subsequent;
    } else if (current->type == AST_ERB_ELSE_NODE) {
      AST_ERB_ELSE_NODE_T* else_node = (AST_ERB_ELSE_NODE_T*) current;
      branch_statements = else_node->statements;
      next_subsequent = NULL;
      ends_with_else = true;
    } else {
      return NULL;
    }

    single_open_tag_result_T branch_result = get_single_open_tag_from_statements(branch_statements);
    if (!branch_result.tag) { return NULL; }

    const char* branch_tag_name = get_open_tag_name(branch_result.tag);
    if (!branch_tag_name) { return NULL; }

    if (!hb_string_equals_case_insensitive(hb_string(common_tag_name), hb_string(branch_tag_name))) { return NULL; }

    current = next_subsequent;
  }

  if (!ends_with_else) { return NULL; }

  return common_tag_name;
}

static const char* check_erb_unless_conditional_open_tag(AST_ERB_UNLESS_NODE_T* unless_node) {
  if (!unless_node) { return NULL; }
  if (!unless_node->else_clause) { return NULL; }

  single_open_tag_result_T unless_result = get_single_open_tag_from_statements(unless_node->statements);
  if (!unless_result.tag) { return NULL; }

  const char* common_tag_name = get_open_tag_name(unless_result.tag);
  if (!common_tag_name) { return NULL; }

  single_open_tag_result_T else_result = get_single_open_tag_from_statements(unless_node->else_clause->statements);
  if (!else_result.tag) { return NULL; }

  const char* else_tag_name = get_open_tag_name(else_result.tag);
  if (!else_tag_name) { return NULL; }

  if (!hb_string_equals_case_insensitive(hb_string(common_tag_name), hb_string(else_tag_name))) { return NULL; }

  return common_tag_name;
}

static size_t find_matching_close_tag(
  hb_array_T* siblings,
  size_t start_index,
  const char* tag_name,
  AST_HTML_CLOSE_TAG_NODE_T** out_close_tag
) {
  *out_close_tag = NULL;

  for (size_t i = start_index + 1; i < hb_array_size(siblings); i++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(siblings, i);
    if (!node) { continue; }

    if (node->type == AST_HTML_CLOSE_TAG_NODE) {
      AST_HTML_CLOSE_TAG_NODE_T* close_tag = (AST_HTML_CLOSE_TAG_NODE_T*) node;

      if (close_tag->tag_name && close_tag->tag_name->value) {
        if (hb_string_equals_case_insensitive(hb_string(tag_name), hb_string(close_tag->tag_name->value))) {
          *out_close_tag = close_tag;
          return i;
        }
      }
    }
  }

  return (size_t) -1;
}

static token_T* get_first_branch_tag_name_token(AST_ERB_IF_NODE_T* if_node) {
  single_open_tag_result_T result = get_single_open_tag_from_statements(if_node->statements);

  return result.tag ? result.tag->tag_name : NULL;
}

static token_T* get_first_branch_tag_name_token_unless(AST_ERB_UNLESS_NODE_T* unless_node) {
  single_open_tag_result_T result = get_single_open_tag_from_statements(unless_node->statements);

  return result.tag ? result.tag->tag_name : NULL;
}

static void add_multiple_tags_error_to_erb_node(AST_NODE_T* erb_node, AST_HTML_OPEN_TAG_NODE_T* second_tag) {
  if (!erb_node || !second_tag) { return; }

  CONDITIONAL_ELEMENT_MULTIPLE_TAGS_ERROR_T* error = conditional_element_multiple_tags_error_init(
    second_tag->base.location.start.line,
    second_tag->base.location.start.column,
    erb_node->location.start,
    erb_node->location.end
  );

  if (!erb_node->errors) { erb_node->errors = hb_array_init(1); }

  hb_array_append(erb_node->errors, error);
}

static void check_and_report_multiple_tags_in_if(AST_ERB_IF_NODE_T* if_node) {
  if (!if_node || !if_node->subsequent) { return; }

  single_open_tag_result_T if_result = get_single_open_tag_from_statements(if_node->statements);

  if (if_result.has_multiple_tags) {
    add_multiple_tags_error_to_erb_node((AST_NODE_T*) if_node, if_result.second_tag);
    return;
  }

  if (!if_result.tag) { return; }

  AST_NODE_T* current = if_node->subsequent;
  bool ends_with_else = false;

  while (current) {
    hb_array_T* branch_statements = NULL;
    AST_NODE_T* next_subsequent = NULL;

    if (current->type == AST_ERB_IF_NODE) {
      AST_ERB_IF_NODE_T* elsif_node = (AST_ERB_IF_NODE_T*) current;
      branch_statements = elsif_node->statements;
      next_subsequent = elsif_node->subsequent;
    } else if (current->type == AST_ERB_ELSE_NODE) {
      AST_ERB_ELSE_NODE_T* else_node = (AST_ERB_ELSE_NODE_T*) current;
      branch_statements = else_node->statements;
      next_subsequent = NULL;
      ends_with_else = true;
    } else {
      return;
    }

    single_open_tag_result_T branch_result = get_single_open_tag_from_statements(branch_statements);
    if (branch_result.has_multiple_tags) {
      add_multiple_tags_error_to_erb_node(current, branch_result.second_tag);
      return;
    }
    if (!branch_result.tag) { return; }

    current = next_subsequent;
  }

  (void) ends_with_else;
}

static void check_and_report_multiple_tags_in_unless(AST_ERB_UNLESS_NODE_T* unless_node) {
  if (!unless_node || !unless_node->else_clause) { return; }

  single_open_tag_result_T unless_result = get_single_open_tag_from_statements(unless_node->statements);

  if (unless_result.has_multiple_tags) {
    add_multiple_tags_error_to_erb_node((AST_NODE_T*) unless_node, unless_result.second_tag);
    return;
  }

  if (!unless_result.tag) { return; }

  single_open_tag_result_T else_result = get_single_open_tag_from_statements(unless_node->else_clause->statements);

  if (else_result.has_multiple_tags) {
    add_multiple_tags_error_to_erb_node((AST_NODE_T*) unless_node->else_clause, else_result.second_tag);
    return;
  }
}

static void rewrite_conditional_open_tags(hb_array_T* nodes, hb_array_T* document_errors) {
  (void) document_errors;

  if (!nodes || hb_array_size(nodes) == 0) { return; }

  hb_array_T* consumed_indices = hb_array_init(8);

  for (size_t i = 0; i < hb_array_size(nodes); i++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(nodes, i);
    if (!node) { continue; }

    const char* tag_name = NULL;
    AST_NODE_T* conditional_node = NULL;
    token_T* tag_name_token = NULL;

    if (node->type == AST_ERB_IF_NODE) {
      AST_ERB_IF_NODE_T* if_node = (AST_ERB_IF_NODE_T*) node;
      tag_name = check_erb_if_conditional_open_tag(if_node);

      if (tag_name) {
        conditional_node = node;
        tag_name_token = get_first_branch_tag_name_token(if_node);
      } else {
        check_and_report_multiple_tags_in_if(if_node);
      }
    } else if (node->type == AST_ERB_UNLESS_NODE) {
      AST_ERB_UNLESS_NODE_T* unless_node = (AST_ERB_UNLESS_NODE_T*) node;
      tag_name = check_erb_unless_conditional_open_tag(unless_node);

      if (tag_name) {
        conditional_node = node;
        tag_name_token = get_first_branch_tag_name_token_unless(unless_node);
      } else {
        check_and_report_multiple_tags_in_unless(unless_node);
      }
    }

    if (!tag_name || !conditional_node || !tag_name_token) { continue; }

    AST_HTML_CLOSE_TAG_NODE_T* close_tag = NULL;
    size_t close_index = find_matching_close_tag(nodes, i, tag_name, &close_tag);

    if (close_index == (size_t) -1 || !close_tag) { continue; }

    hb_array_T* body = hb_array_init(8);

    for (size_t j = i + 1; j < close_index; j++) {
      AST_NODE_T* body_node = (AST_NODE_T*) hb_array_get(nodes, j);
      if (body_node) { hb_array_append(body, body_node); }
    }

    position_T start_position = conditional_node->location.start;
    position_T end_position = close_tag->base.location.end;

    hb_array_T* conditional_open_tag_errors = hb_array_init(1);

    AST_HTML_CONDITIONAL_OPEN_TAG_NODE_T* conditional_open_tag = ast_html_conditional_open_tag_node_init(
      conditional_node,
      tag_name_token,
      false,
      conditional_node->location.start,
      conditional_node->location.end,
      conditional_open_tag_errors
    );

    hb_array_T* element_errors = hb_array_init(1);

    AST_HTML_ELEMENT_NODE_T* element = ast_html_element_node_init(
      (AST_NODE_T*) conditional_open_tag,
      tag_name_token,
      body,
      (AST_NODE_T*) close_tag,
      false,
      ELEMENT_SOURCE_HTML,
      start_position,
      end_position,
      element_errors
    );

    hb_array_set(nodes, i, element);

    for (size_t j = i + 1; j <= close_index; j++) {
      size_t* index = malloc(sizeof(size_t));

      if (index) {
        *index = j;
        hb_array_append(consumed_indices, index);
      }
    }
  }

  if (hb_array_size(consumed_indices) > 0) {
    hb_array_T* new_nodes = hb_array_init(hb_array_size(nodes));

    for (size_t i = 0; i < hb_array_size(nodes); i++) {
      bool consumed = false;

      for (size_t j = 0; j < hb_array_size(consumed_indices); j++) {
        size_t* stored_index = (size_t*) hb_array_get(consumed_indices, j);

        if (stored_index && *stored_index == i) {
          consumed = true;
          break;
        }
      }

      if (!consumed) {
        AST_NODE_T* node = (AST_NODE_T*) hb_array_get(nodes, i);
        if (node) { hb_array_append(new_nodes, node); }
      }
    }

    nodes->size = 0;

    for (size_t i = 0; i < hb_array_size(new_nodes); i++) {
      hb_array_append(nodes, hb_array_get(new_nodes, i));
    }

    hb_array_free(&new_nodes);
  }

  for (size_t i = 0; i < hb_array_size(consumed_indices); i++) {
    size_t* index = (size_t*) hb_array_get(consumed_indices, i);
    if (index) { free(index); }
  }

  hb_array_free(&consumed_indices);
}

static void transform_conditional_open_tags_in_array(hb_array_T* array, hb_array_T* document_errors) {
  if (!array) { return; }

  for (size_t i = 0; i < hb_array_size(array); i++) {
    AST_NODE_T* child = (AST_NODE_T*) hb_array_get(array, i);
    if (child) { herb_visit_node(child, transform_conditional_open_tags_visitor, document_errors); }
  }

  rewrite_conditional_open_tags(array, document_errors);
}

static bool transform_conditional_open_tags_visitor(const AST_NODE_T* node, void* data) {
  if (!node) { return false; }

  hb_array_T* document_errors = (hb_array_T*) data;

  switch (node->type) {
    case AST_DOCUMENT_NODE: {
      AST_DOCUMENT_NODE_T* doc = (AST_DOCUMENT_NODE_T*) node;
      transform_conditional_open_tags_in_array(doc->children, document_errors);
      return false;
    }

    case AST_HTML_ELEMENT_NODE: {
      AST_HTML_ELEMENT_NODE_T* element = (AST_HTML_ELEMENT_NODE_T*) node;
      transform_conditional_open_tags_in_array(element->body, document_errors);
      return false;
    }

    case AST_HTML_CONDITIONAL_ELEMENT_NODE: {
      AST_HTML_CONDITIONAL_ELEMENT_NODE_T* conditional = (AST_HTML_CONDITIONAL_ELEMENT_NODE_T*) node;
      transform_conditional_open_tags_in_array(conditional->body, document_errors);
      return false;
    }

    case AST_ERB_IF_NODE: {
      AST_ERB_IF_NODE_T* if_node = (AST_ERB_IF_NODE_T*) node;
      transform_conditional_open_tags_in_array(if_node->statements, document_errors);

      if (if_node->subsequent) { herb_visit_node(if_node->subsequent, transform_conditional_open_tags_visitor, data); }

      return false;
    }

    case AST_ERB_ELSE_NODE: {
      AST_ERB_ELSE_NODE_T* else_node = (AST_ERB_ELSE_NODE_T*) node;
      transform_conditional_open_tags_in_array(else_node->statements, document_errors);
      return false;
    }

    case AST_ERB_UNLESS_NODE: {
      AST_ERB_UNLESS_NODE_T* unless_node = (AST_ERB_UNLESS_NODE_T*) node;
      transform_conditional_open_tags_in_array(unless_node->statements, document_errors);

      if (unless_node->else_clause) {
        herb_visit_node((AST_NODE_T*) unless_node->else_clause, transform_conditional_open_tags_visitor, data);
      }
      return false;
    }

    case AST_ERB_BLOCK_NODE: {
      AST_ERB_BLOCK_NODE_T* block_node = (AST_ERB_BLOCK_NODE_T*) node;
      transform_conditional_open_tags_in_array(block_node->body, document_errors);
      return false;
    }

    case AST_ERB_WHILE_NODE: {
      AST_ERB_WHILE_NODE_T* while_node = (AST_ERB_WHILE_NODE_T*) node;
      transform_conditional_open_tags_in_array(while_node->statements, document_errors);
      return false;
    }

    case AST_ERB_UNTIL_NODE: {
      AST_ERB_UNTIL_NODE_T* until_node = (AST_ERB_UNTIL_NODE_T*) node;
      transform_conditional_open_tags_in_array(until_node->statements, document_errors);
      return false;
    }

    case AST_ERB_FOR_NODE: {
      AST_ERB_FOR_NODE_T* for_node = (AST_ERB_FOR_NODE_T*) node;
      transform_conditional_open_tags_in_array(for_node->statements, document_errors);
      return false;
    }

    case AST_ERB_CASE_NODE: {
      AST_ERB_CASE_NODE_T* case_node = (AST_ERB_CASE_NODE_T*) node;
      transform_conditional_open_tags_in_array(case_node->children, document_errors);

      for (size_t i = 0; i < hb_array_size(case_node->conditions); i++) {
        AST_NODE_T* when_node = (AST_NODE_T*) hb_array_get(case_node->conditions, i);
        if (when_node) { herb_visit_node(when_node, transform_conditional_open_tags_visitor, data); }
      }

      if (case_node->else_clause) {
        herb_visit_node((AST_NODE_T*) case_node->else_clause, transform_conditional_open_tags_visitor, data);
      }

      return false;
    }

    case AST_ERB_CASE_MATCH_NODE: {
      AST_ERB_CASE_MATCH_NODE_T* case_match_node = (AST_ERB_CASE_MATCH_NODE_T*) node;
      transform_conditional_open_tags_in_array(case_match_node->children, document_errors);

      for (size_t i = 0; i < hb_array_size(case_match_node->conditions); i++) {
        AST_NODE_T* in_node = (AST_NODE_T*) hb_array_get(case_match_node->conditions, i);
        if (in_node) { herb_visit_node(in_node, transform_conditional_open_tags_visitor, data); }
      }

      if (case_match_node->else_clause) {
        herb_visit_node((AST_NODE_T*) case_match_node->else_clause, transform_conditional_open_tags_visitor, data);
      }

      return false;
    }

    case AST_ERB_WHEN_NODE: {
      AST_ERB_WHEN_NODE_T* when_node = (AST_ERB_WHEN_NODE_T*) node;
      transform_conditional_open_tags_in_array(when_node->statements, document_errors);
      return false;
    }

    case AST_ERB_IN_NODE: {
      AST_ERB_IN_NODE_T* in_node = (AST_ERB_IN_NODE_T*) node;
      transform_conditional_open_tags_in_array(in_node->statements, document_errors);
      return false;
    }

    case AST_ERB_BEGIN_NODE: {
      AST_ERB_BEGIN_NODE_T* begin_node = (AST_ERB_BEGIN_NODE_T*) node;
      transform_conditional_open_tags_in_array(begin_node->statements, document_errors);

      if (begin_node->rescue_clause) {
        herb_visit_node((AST_NODE_T*) begin_node->rescue_clause, transform_conditional_open_tags_visitor, data);
      }

      if (begin_node->else_clause) {
        herb_visit_node((AST_NODE_T*) begin_node->else_clause, transform_conditional_open_tags_visitor, data);
      }

      if (begin_node->ensure_clause) {
        herb_visit_node((AST_NODE_T*) begin_node->ensure_clause, transform_conditional_open_tags_visitor, data);
      }

      return false;
    }

    case AST_ERB_RESCUE_NODE: {
      AST_ERB_RESCUE_NODE_T* rescue_node = (AST_ERB_RESCUE_NODE_T*) node;
      transform_conditional_open_tags_in_array(rescue_node->statements, document_errors);

      if (rescue_node->subsequent) {
        herb_visit_node((AST_NODE_T*) rescue_node->subsequent, transform_conditional_open_tags_visitor, data);
      }

      return false;
    }

    case AST_ERB_ENSURE_NODE: {
      AST_ERB_ENSURE_NODE_T* ensure_node = (AST_ERB_ENSURE_NODE_T*) node;
      transform_conditional_open_tags_in_array(ensure_node->statements, document_errors);
      return false;
    }

    default: return true;
  }
}

void herb_transform_conditional_open_tags(AST_DOCUMENT_NODE_T* document) {
  herb_visit_node((AST_NODE_T*) document, transform_conditional_open_tags_visitor, document->base.errors);
}
