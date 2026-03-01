#include "../include/analyze/analyze.h"
#include "../include/analyze/analyzed_ruby.h"
#include "../include/analyze/builders.h"
#include "../include/analyze/conditional_elements.h"
#include "../include/analyze/conditional_open_tags.h"
#include "../include/analyze/control_type.h"
#include "../include/analyze/helpers.h"
#include "../include/analyze/invalid_structures.h"
#include "../include/ast_node.h"
#include "../include/ast_nodes.h"
#include "../include/errors.h"
#include "../include/location.h"
#include "../include/parser.h"
#include "../include/position.h"
#include "../include/token_struct.h"
#include "../include/util/hb_array.h"
#include "../include/util/hb_string.h"
#include "../include/util/string.h"
#include "../include/visitor.h"

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
  pm_visit_node(analyzed->root, search_when_nodes, analyzed);
  pm_visit_node(analyzed->root, search_in_nodes, analyzed);

  search_unexpected_elsif_nodes(analyzed);
  search_unexpected_else_nodes(analyzed);
  search_unexpected_end_nodes(analyzed);
  search_unexpected_when_nodes(analyzed);
  search_unexpected_in_nodes(analyzed);

  search_unexpected_rescue_nodes(analyzed);
  search_unexpected_ensure_nodes(analyzed);
  search_yield_nodes(analyzed->root, analyzed);
  search_then_keywords(analyzed->root, analyzed);
  search_unexpected_block_closing_nodes(analyzed);

  if (!analyzed->valid) { pm_visit_node(analyzed->root, search_unclosed_control_flows, analyzed); }

  return analyzed;
}

static bool analyze_erb_content(const AST_NODE_T* node, void* data) {
  if (node->type == AST_ERB_CONTENT_NODE) {
    AST_ERB_CONTENT_NODE_T* erb_content_node = (AST_ERB_CONTENT_NODE_T*) node;

    const char* opening = erb_content_node->tag_opening->value;

    if (!string_equals(opening, "<%%") && !string_equals(opening, "<%%=") && !string_equals(opening, "<%#")
        && !string_equals(opening, "<%graphql")) {
      analyzed_ruby_T* analyzed = herb_analyze_ruby(hb_string(erb_content_node->content->value));

      erb_content_node->parsed = true;
      erb_content_node->valid = analyzed->valid;
      erb_content_node->analyzed_ruby = analyzed;

      if (!analyzed->valid && analyzed->unclosed_control_flow_count >= 2) {
        append_erb_multiple_blocks_in_tag_error(
          erb_content_node->base.location.start,
          erb_content_node->base.location.end,
          erb_content_node->base.errors
        );
      }

      if (!analyzed->valid
          && ((analyzed->case_node_count > 0 && analyzed->when_node_count > 0)
              || (analyzed->case_match_node_count > 0 && analyzed->in_node_count > 0))) {
        append_erb_case_with_conditions_error(
          erb_content_node->base.location.start,
          erb_content_node->base.location.end,
          erb_content_node->base.errors
        );
      }
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

// --- Helper functions for structure processing ---

static bool control_type_matches_any(control_type_t type, const control_type_t* list, size_t count) {
  if (!list) { return false; }

  for (size_t i = 0; i < count; i++) {
    if (type == list[i]) { return true; }
  }

  return false;
}

static AST_ERB_CONTENT_NODE_T* get_erb_content_at(hb_array_T* array, size_t index) {
  if (index >= hb_array_size(array)) { return NULL; }

  AST_NODE_T* node = hb_array_get(array, index);

  if (!node || node->type != AST_ERB_CONTENT_NODE) { return NULL; }

  return (AST_ERB_CONTENT_NODE_T*) node;
}

static bool peek_control_type(
  hb_array_T* array,
  size_t index,
  control_type_t* out_type,
  AST_ERB_CONTENT_NODE_T** out_node
) {
  AST_ERB_CONTENT_NODE_T* erb_node = get_erb_content_at(array, index);

  if (!erb_node) { return false; }

  if (out_type) { *out_type = detect_control_type(erb_node); }
  if (out_node) { *out_node = erb_node; }

  return true;
}

static void collect_children_until(
  hb_array_T* array,
  size_t* index,
  hb_array_T* destination,
  const control_type_t* stop_types,
  size_t stop_count
) {
  while (*index < hb_array_size(array)) {
    AST_NODE_T* child = hb_array_get(array, *index);

    if (!child) { break; }

    if (child->type == AST_ERB_CONTENT_NODE) {
      control_type_t child_type = detect_control_type((AST_ERB_CONTENT_NODE_T*) child);

      if (stop_count > 0 && control_type_matches_any(child_type, stop_types, stop_count)) { break; }
    }

    hb_array_append(destination, child);

    (*index)++;
  }
}

static AST_ERB_END_NODE_T* build_end_node(AST_ERB_CONTENT_NODE_T* end_erb) {
  if (!end_erb) { return NULL; }

  hb_array_T* end_errors = end_erb->base.errors;
  end_erb->base.errors = NULL;

  AST_ERB_END_NODE_T* end_node = ast_erb_end_node_init(
    end_erb->tag_opening,
    end_erb->content,
    end_erb->tag_closing,
    end_erb->tag_opening->location.start,
    erb_content_end_position(end_erb),
    end_errors
  );

  ast_node_free((AST_NODE_T*) end_erb);

  return end_node;
}

static AST_ERB_END_NODE_T* consume_end_node(
  hb_array_T* array,
  size_t* index,
  const control_type_t* allowed_types,
  size_t allowed_count
) {
  if (allowed_count == 0 || !allowed_types) { return NULL; }

  AST_ERB_CONTENT_NODE_T* candidate = get_erb_content_at(array, *index);

  if (!candidate) { return NULL; }

  control_type_t candidate_type = detect_control_type(candidate);

  if (!control_type_matches_any(candidate_type, allowed_types, allowed_count)) { return NULL; }

  (*index)++;

  return build_end_node(candidate);
}

// --- Structure processing functions ---

static size_t process_case_structure(
  AST_NODE_T* node,
  hb_array_T* array,
  size_t index,
  hb_array_T* output_array,
  analyze_ruby_context_T* context
);

static size_t process_begin_structure(
  AST_NODE_T* node,
  hb_array_T* array,
  size_t index,
  hb_array_T* output_array,
  analyze_ruby_context_T* context
);

static size_t process_generic_structure(
  AST_NODE_T* node,
  hb_array_T* array,
  size_t index,
  hb_array_T* output_array,
  analyze_ruby_context_T* context,
  control_type_t initial_type
);

static size_t process_control_structure(
  AST_NODE_T* node,
  hb_array_T* array,
  size_t index,
  hb_array_T* output_array,
  analyze_ruby_context_T* context,
  control_type_t initial_type
) {
  switch (initial_type) {
    case CONTROL_TYPE_CASE:
    case CONTROL_TYPE_CASE_MATCH: return process_case_structure(node, array, index, output_array, context);

    case CONTROL_TYPE_BEGIN: return process_begin_structure(node, array, index, output_array, context);

    default: return process_generic_structure(node, array, index, output_array, context, initial_type);
  }
}

static size_t process_case_structure(
  AST_NODE_T* node,
  hb_array_T* array,
  size_t index,
  hb_array_T* output_array,
  analyze_ruby_context_T* context
) {
  AST_ERB_CONTENT_NODE_T* erb_node = get_erb_content_at(array, index);
  if (!erb_node) { return index; }

  hb_array_T* when_conditions = hb_array_init(8);
  hb_array_T* in_conditions = hb_array_init(8);
  hb_array_T* non_when_non_in_children = hb_array_init(8);

  index++;

  const control_type_t prelude_stop[] = { CONTROL_TYPE_WHEN, CONTROL_TYPE_IN, CONTROL_TYPE_END };
  collect_children_until(
    array,
    &index,
    non_when_non_in_children,
    prelude_stop,
    sizeof(prelude_stop) / sizeof(prelude_stop[0])
  );

  while (index < hb_array_size(array)) {
    AST_ERB_CONTENT_NODE_T* next_erb = get_erb_content_at(array, index);

    if (!next_erb) {
      AST_NODE_T* next_node = hb_array_get(array, index);

      if (!next_node) { break; }

      hb_array_append(non_when_non_in_children, next_node);
      index++;
      continue;
    }

    control_type_t next_type = detect_control_type(next_erb);

    if (next_type == CONTROL_TYPE_WHEN || next_type == CONTROL_TYPE_IN) {
      hb_array_T* statements = hb_array_init(8);
      index++;
      index = process_block_children(node, array, index, statements, context, next_type);

      hb_array_T* cond_errors = next_erb->base.errors;
      next_erb->base.errors = NULL;

      location_T* then_keyword = compute_then_keyword(next_erb, next_type);
      position_T cond_start = next_erb->tag_opening->location.start;
      position_T cond_end = erb_content_end_position(next_erb);

      AST_NODE_T* condition_node;

      if (next_type == CONTROL_TYPE_WHEN) {
        condition_node = (AST_NODE_T*) ast_erb_when_node_init(
          next_erb->tag_opening,
          next_erb->content,
          next_erb->tag_closing,
          then_keyword,
          statements,
          cond_start,
          cond_end,
          cond_errors
        );
      } else {
        condition_node = (AST_NODE_T*) ast_erb_in_node_init(
          next_erb->tag_opening,
          next_erb->content,
          next_erb->tag_closing,
          then_keyword,
          statements,
          cond_start,
          cond_end,
          cond_errors
        );
      }

      ast_node_free((AST_NODE_T*) next_erb);
      hb_array_append(next_type == CONTROL_TYPE_WHEN ? when_conditions : in_conditions, condition_node);
      continue;
    }

    if (next_type == CONTROL_TYPE_ELSE || next_type == CONTROL_TYPE_END) { break; }

    hb_array_append(non_when_non_in_children, (AST_NODE_T*) next_erb);
    index++;
  }

  AST_ERB_ELSE_NODE_T* else_clause = NULL;
  control_type_t next_type = CONTROL_TYPE_UNKNOWN;
  AST_ERB_CONTENT_NODE_T* next_erb = NULL;

  if (peek_control_type(array, index, &next_type, &next_erb) && next_type == CONTROL_TYPE_ELSE) {
    hb_array_T* else_children = hb_array_init(8);
    index++;

    index = process_block_children(node, array, index, else_children, context, CONTROL_TYPE_CASE);

    hb_array_T* else_errors = next_erb->base.errors;
    next_erb->base.errors = NULL;

    else_clause = ast_erb_else_node_init(
      next_erb->tag_opening,
      next_erb->content,
      next_erb->tag_closing,
      else_children,
      next_erb->tag_opening->location.start,
      erb_content_end_position(next_erb),
      else_errors
    );

    ast_node_free((AST_NODE_T*) next_erb);
  }

  const control_type_t end_types[] = { CONTROL_TYPE_END };
  AST_ERB_END_NODE_T* end_node = consume_end_node(array, &index, end_types, sizeof(end_types) / sizeof(end_types[0]));

  position_T start_position = erb_node->tag_opening->location.start;
  position_T end_position = erb_content_end_position(erb_node);

  if (end_node) {
    end_position = end_node->base.location.end;
  } else if (else_clause) {
    end_position = else_clause->base.location.end;
  } else if (hb_array_size(when_conditions) > 0) {
    AST_NODE_T* last_when = hb_array_last(when_conditions);
    end_position = last_when->location.end;
  } else if (hb_array_size(in_conditions) > 0) {
    AST_NODE_T* last_in = hb_array_last(in_conditions);
    end_position = last_in->location.end;
  }

  hb_array_T* node_errors = erb_node->base.errors;
  erb_node->base.errors = NULL;

  if (hb_array_size(in_conditions) > 0) {
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
      node_errors
    );

    ast_node_free((AST_NODE_T*) erb_node);
    hb_array_append(output_array, (AST_NODE_T*) case_match_node);
    hb_array_free(&when_conditions);
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
    node_errors
  );

  ast_node_free((AST_NODE_T*) erb_node);
  hb_array_append(output_array, (AST_NODE_T*) case_node);
  hb_array_free(&in_conditions);

  return index;
}

static size_t process_begin_structure(
  AST_NODE_T* node,
  hb_array_T* array,
  size_t index,
  hb_array_T* output_array,
  analyze_ruby_context_T* context
) {
  AST_ERB_CONTENT_NODE_T* erb_node = get_erb_content_at(array, index);
  if (!erb_node) { return index; }
  hb_array_T* children = hb_array_init(8);

  index++;
  index = process_block_children(node, array, index, children, context, CONTROL_TYPE_BEGIN);

  AST_ERB_RESCUE_NODE_T* rescue_clause = NULL;
  AST_ERB_ELSE_NODE_T* else_clause = NULL;
  AST_ERB_ENSURE_NODE_T* ensure_clause = NULL;

  control_type_t next_type = CONTROL_TYPE_UNKNOWN;
  AST_ERB_CONTENT_NODE_T* next_erb = NULL;

  if (peek_control_type(array, index, &next_type, &next_erb) && next_type == CONTROL_TYPE_RESCUE) {
    AST_NODE_T* rescue_node = NULL;
    index = process_subsequent_block(node, array, index, &rescue_node, context, CONTROL_TYPE_BEGIN);
    rescue_clause = (AST_ERB_RESCUE_NODE_T*) rescue_node;
  }

  if (peek_control_type(array, index, &next_type, &next_erb) && next_type == CONTROL_TYPE_ELSE) {
    hb_array_T* else_children = hb_array_init(8);
    index++;

    index = process_block_children(node, array, index, else_children, context, CONTROL_TYPE_BEGIN);

    hb_array_T* else_errors = next_erb->base.errors;
    next_erb->base.errors = NULL;

    else_clause = ast_erb_else_node_init(
      next_erb->tag_opening,
      next_erb->content,
      next_erb->tag_closing,
      else_children,
      next_erb->tag_opening->location.start,
      erb_content_end_position(next_erb),
      else_errors
    );

    ast_node_free((AST_NODE_T*) next_erb);
  }

  if (peek_control_type(array, index, &next_type, &next_erb) && next_type == CONTROL_TYPE_ENSURE) {
    hb_array_T* ensure_children = hb_array_init(8);
    index++;

    const control_type_t ensure_stop[] = { CONTROL_TYPE_END };
    collect_children_until(array, &index, ensure_children, ensure_stop, sizeof(ensure_stop) / sizeof(ensure_stop[0]));

    hb_array_T* ensure_errors = next_erb->base.errors;
    next_erb->base.errors = NULL;

    ensure_clause = ast_erb_ensure_node_init(
      next_erb->tag_opening,
      next_erb->content,
      next_erb->tag_closing,
      ensure_children,
      next_erb->tag_opening->location.start,
      erb_content_end_position(next_erb),
      ensure_errors
    );

    ast_node_free((AST_NODE_T*) next_erb);
  }

  const control_type_t end_types[] = { CONTROL_TYPE_END };
  AST_ERB_END_NODE_T* end_node = consume_end_node(array, &index, end_types, sizeof(end_types) / sizeof(end_types[0]));

  position_T start_position = erb_node->tag_opening->location.start;
  position_T end_position = erb_content_end_position(erb_node);

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

static size_t process_generic_structure(
  AST_NODE_T* node,
  hb_array_T* array,
  size_t index,
  hb_array_T* output_array,
  analyze_ruby_context_T* context,
  control_type_t initial_type
) {
  AST_ERB_CONTENT_NODE_T* erb_node = get_erb_content_at(array, index);
  if (!erb_node) { return index; }
  hb_array_T* children = hb_array_init(8);

  index++;
  index = process_block_children(node, array, index, children, context, initial_type);

  AST_NODE_T* subsequent = NULL;
  control_type_t next_type = CONTROL_TYPE_UNKNOWN;

  if (peek_control_type(array, index, &next_type, NULL) && is_subsequent_type(initial_type, next_type)) {
    index = process_subsequent_block(node, array, index, &subsequent, context, initial_type);
  }

  AST_ERB_END_NODE_T* end_node = NULL;

  if (initial_type == CONTROL_TYPE_BLOCK) {
    const control_type_t block_end_types[] = { CONTROL_TYPE_BLOCK_CLOSE, CONTROL_TYPE_END };
    end_node = consume_end_node(array, &index, block_end_types, sizeof(block_end_types) / sizeof(block_end_types[0]));
  } else {
    const control_type_t default_end_types[] = { CONTROL_TYPE_END };
    end_node =
      consume_end_node(array, &index, default_end_types, sizeof(default_end_types) / sizeof(default_end_types[0]));
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
  AST_ERB_CONTENT_NODE_T* erb_node = get_erb_content_at(array, index);

  if (!erb_node) { return index; }

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

  control_type_t next_type = CONTROL_TYPE_UNKNOWN;

  if (peek_control_type(array, index, &next_type, NULL) && is_subsequent_type(parent_type, next_type)
      && !(type == CONTROL_TYPE_RESCUE && (next_type == CONTROL_TYPE_ELSE || next_type == CONTROL_TYPE_ENSURE))) {

    AST_NODE_T** next_subsequent = NULL;

    switch (type) {
      case CONTROL_TYPE_ELSIF: {
        if (subsequent_node && subsequent_node->type == AST_ERB_IF_NODE) {
          next_subsequent = &(((AST_ERB_IF_NODE_T*) subsequent_node)->subsequent);
        }

        break;
      }

      case CONTROL_TYPE_RESCUE: {
        if (subsequent_node && subsequent_node->type == AST_ERB_RESCUE_NODE && next_type == CONTROL_TYPE_RESCUE) {
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
  while (index < hb_array_size(array)) {
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

    if (is_compound_control_type(child_type)) {
      hb_array_T* temp_array = hb_array_init(1);
      size_t new_index = process_control_structure(node, array, index, temp_array, context, child_type);

      if (hb_array_size(temp_array) > 0) { hb_array_append(children_array, hb_array_first(temp_array)); }

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
  hb_array_T* new_array = hb_array_init(hb_array_size(array));
  size_t index = 0;

  while (index < hb_array_size(array)) {
    AST_NODE_T* item = hb_array_get(array, index);

    if (!item) { break; }

    if (item->type != AST_ERB_CONTENT_NODE) {
      hb_array_append(new_array, item);
      index++;
      continue;
    }

    AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) item;
    control_type_t type = detect_control_type(erb_node);

    if (is_compound_control_type(type)) {
      index = process_control_structure(node, array, index, new_array, context, type);
      continue;
    }

    if (type == CONTROL_TYPE_YIELD) {
      AST_NODE_T* yield_node = create_control_node(erb_node, NULL, NULL, NULL, type);

      if (yield_node) {
        ast_node_free((AST_NODE_T*) erb_node);
        hb_array_append(new_array, yield_node);
      } else {
        hb_array_append(new_array, item);
      }

      index++;
      continue;
    }

    hb_array_append(new_array, item);
    index++;
  }

  return new_array;
}

void herb_analyze_parse_tree(AST_DOCUMENT_NODE_T* document, const char* source, bool strict) {
  herb_visit_node((AST_NODE_T*) document, analyze_erb_content, NULL);

  analyze_ruby_context_T* context = malloc(sizeof(analyze_ruby_context_T));

  if (!context) { return; }

  context->document = document;
  context->parent = NULL;
  context->ruby_context_stack = hb_array_init(8);

  herb_visit_node((AST_NODE_T*) document, transform_erb_nodes, context);
  herb_transform_conditional_elements(document);
  herb_transform_conditional_open_tags(document);

  invalid_erb_context_T* invalid_context = malloc(sizeof(invalid_erb_context_T));

  if (!invalid_context) {
    hb_array_free(&context->ruby_context_stack);
    free(context);
    return;
  }

  invalid_context->loop_depth = 0;
  invalid_context->rescue_depth = 0;

  herb_visit_node((AST_NODE_T*) document, detect_invalid_erb_structures, invalid_context);

  herb_analyze_parse_errors(document, source);

  herb_parser_match_html_tags_post_analyze(document, strict);

  hb_array_free(&context->ruby_context_stack);

  free(context);
  free(invalid_context);
}
