#include "include/analyze.h"
#include "include/analyze_helpers.h"
#include "include/analyzed_ruby.h"
#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/errors.h"
#include "include/extract.h"
#include "include/location.h"
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

static control_type_t detect_control_type(AST_ERB_CONTENT_NODE_T* erb_node) {
  if (!erb_node || erb_node->base.type != AST_ERB_CONTENT_NODE) { return CONTROL_TYPE_UNKNOWN; }

  analyzed_ruby_T* ruby = erb_node->analyzed_ruby;

  if (!ruby) { return CONTROL_TYPE_UNKNOWN; }

  if (ruby->valid) { return CONTROL_TYPE_UNKNOWN; }

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
  if (has_yield_node(ruby)) { return CONTROL_TYPE_YIELD; }

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

typedef struct {
  AST_ERB_CONTENT_NODE_T* erb;
  hb_array_T* children;
  AST_NODE_T* subsequent;
  AST_ERB_END_NODE_T* end_node;
  token_T* tag_opening;
  token_T* content;
  token_T* tag_closing;
  position_T start_position;
  position_T end_position;
  hb_array_T* errors;
  control_type_t control_type;
} control_build_context_T;

typedef AST_NODE_T* (*control_builder_fn)(control_build_context_T* context);

typedef struct {
  control_type_t type;
  control_builder_fn builder;
} control_builder_entry_T;

static AST_NODE_T* build_if_node(control_build_context_T* context);
static AST_NODE_T* build_else_node(control_build_context_T* context);
static AST_NODE_T* build_case_node(control_build_context_T* context);
static AST_NODE_T* build_when_node(control_build_context_T* context);
static AST_NODE_T* build_in_node(control_build_context_T* context);
static AST_NODE_T* build_begin_node(control_build_context_T* context);
static AST_NODE_T* build_rescue_node(control_build_context_T* context);
static AST_NODE_T* build_ensure_node(control_build_context_T* context);
static AST_NODE_T* build_unless_node(control_build_context_T* context);
static AST_NODE_T* build_while_node(control_build_context_T* context);
static AST_NODE_T* build_until_node(control_build_context_T* context);
static AST_NODE_T* build_for_node(control_build_context_T* context);
static AST_NODE_T* build_block_node(control_build_context_T* context);
static AST_NODE_T* build_yield_node(control_build_context_T* context);

static const control_builder_entry_T CONTROL_BUILDERS[] = {
  { CONTROL_TYPE_IF, build_if_node },           { CONTROL_TYPE_ELSIF, build_if_node },
  { CONTROL_TYPE_ELSE, build_else_node },       { CONTROL_TYPE_CASE, build_case_node },
  { CONTROL_TYPE_CASE_MATCH, build_case_node }, { CONTROL_TYPE_WHEN, build_when_node },
  { CONTROL_TYPE_IN, build_in_node },           { CONTROL_TYPE_BEGIN, build_begin_node },
  { CONTROL_TYPE_RESCUE, build_rescue_node },   { CONTROL_TYPE_ENSURE, build_ensure_node },
  { CONTROL_TYPE_UNLESS, build_unless_node },   { CONTROL_TYPE_WHILE, build_while_node },
  { CONTROL_TYPE_UNTIL, build_until_node },     { CONTROL_TYPE_FOR, build_for_node },
  { CONTROL_TYPE_BLOCK, build_block_node },     { CONTROL_TYPE_YIELD, build_yield_node },
};

static control_builder_fn lookup_control_builder(control_type_t type) {
  for (size_t i = 0; i < sizeof(CONTROL_BUILDERS) / sizeof(CONTROL_BUILDERS[0]); i++) {
    if (CONTROL_BUILDERS[i].type == type) { return CONTROL_BUILDERS[i].builder; }
  }

  return NULL;
}

static AST_NODE_T* create_control_node(
  AST_ERB_CONTENT_NODE_T* erb_node,
  hb_array_T* children,
  AST_NODE_T* subsequent,
  AST_ERB_END_NODE_T* end_node,
  control_type_t control_type
) {
  control_build_context_T context = { .erb = erb_node,
                                      .children = children,
                                      .subsequent = subsequent,
                                      .end_node = end_node,
                                      .tag_opening = erb_node->tag_opening,
                                      .content = erb_node->content,
                                      .tag_closing = erb_node->tag_closing,
                                      .start_position = erb_node->tag_opening->location.start,
                                      .end_position = erb_node->tag_closing->location.end,
                                      .errors = erb_node->base.errors,
                                      .control_type = control_type };

  erb_node->base.errors = NULL;

  if (context.end_node) {
    context.end_position = context.end_node->base.location.end;
  } else if (context.children && hb_array_size(context.children) > 0) {
    AST_NODE_T* last_child = hb_array_get(context.children, hb_array_size(context.children) - 1);
    context.end_position = last_child->location.end;
  } else if (context.subsequent) {
    context.end_position = context.subsequent->location.end;
  }

  control_builder_fn builder = lookup_control_builder(control_type);

  if (!builder) { return NULL; }

  return builder(&context);
}

static AST_NODE_T* build_if_node(control_build_context_T* context) {
  return (AST_NODE_T*) ast_erb_if_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->children,
    context->subsequent,
    context->end_node,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_else_node(control_build_context_T* context) {
  return (AST_NODE_T*) ast_erb_else_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->children,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_case_node(control_build_context_T* context) {
  AST_ERB_ELSE_NODE_T* else_node = NULL;

  if (context->subsequent && context->subsequent->type == AST_ERB_ELSE_NODE) {
    else_node = (AST_ERB_ELSE_NODE_T*) context->subsequent;
  }

  hb_array_T* when_conditions = hb_array_init(8);
  hb_array_T* in_conditions = hb_array_init(8);
  hb_array_T* non_when_non_in_children = hb_array_init(8);

  size_t child_count = context->children ? hb_array_size(context->children) : 0;

  for (size_t i = 0; i < child_count; i++) {
    AST_NODE_T* child = hb_array_get(context->children, i);

    if (child && child->type == AST_ERB_WHEN_NODE) {
      hb_array_append(when_conditions, child);
    } else if (child && child->type == AST_ERB_IN_NODE) {
      hb_array_append(in_conditions, child);
    } else {
      hb_array_append(non_when_non_in_children, child);
    }
  }

  if (context->children) {
    hb_array_free(&context->children);
    context->children = NULL;
  }

  if (hb_array_size(in_conditions) > 0) {
    hb_array_free(&when_conditions);

    return (AST_NODE_T*) ast_erb_case_match_node_init(
      context->tag_opening,
      context->content,
      context->tag_closing,
      non_when_non_in_children,
      in_conditions,
      else_node,
      context->end_node,
      context->start_position,
      context->end_position,
      context->errors
    );
  }

  hb_array_free(&in_conditions);

  return (AST_NODE_T*) ast_erb_case_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    non_when_non_in_children,
    when_conditions,
    else_node,
    context->end_node,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_when_node(control_build_context_T* context) {
  return (AST_NODE_T*) ast_erb_when_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->children,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_in_node(control_build_context_T* context) {
  return (AST_NODE_T*) ast_erb_in_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->children,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_begin_node(control_build_context_T* context) {
  AST_ERB_RESCUE_NODE_T* rescue_clause = NULL;
  AST_ERB_ELSE_NODE_T* else_clause = NULL;
  AST_ERB_ENSURE_NODE_T* ensure_clause = NULL;

  if (context->subsequent) {
    if (context->subsequent->type == AST_ERB_RESCUE_NODE) {
      rescue_clause = (AST_ERB_RESCUE_NODE_T*) context->subsequent;
    } else if (context->subsequent->type == AST_ERB_ELSE_NODE) {
      else_clause = (AST_ERB_ELSE_NODE_T*) context->subsequent;
    } else if (context->subsequent->type == AST_ERB_ENSURE_NODE) {
      ensure_clause = (AST_ERB_ENSURE_NODE_T*) context->subsequent;
    }
  }

  return (AST_NODE_T*) ast_erb_begin_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->children,
    rescue_clause,
    else_clause,
    ensure_clause,
    context->end_node,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_rescue_node(control_build_context_T* context) {
  AST_ERB_RESCUE_NODE_T* rescue_node = NULL;

  if (context->subsequent && context->subsequent->type == AST_ERB_RESCUE_NODE) {
    rescue_node = (AST_ERB_RESCUE_NODE_T*) context->subsequent;
  }

  return (AST_NODE_T*) ast_erb_rescue_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->children,
    rescue_node,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_ensure_node(control_build_context_T* context) {
  return (AST_NODE_T*) ast_erb_ensure_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->children,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_unless_node(control_build_context_T* context) {
  AST_ERB_ELSE_NODE_T* else_clause = NULL;

  if (context->subsequent && context->subsequent->type == AST_ERB_ELSE_NODE) {
    else_clause = (AST_ERB_ELSE_NODE_T*) context->subsequent;
  }

  return (AST_NODE_T*) ast_erb_unless_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->children,
    else_clause,
    context->end_node,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_while_node(control_build_context_T* context) {
  return (AST_NODE_T*) ast_erb_while_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->children,
    context->end_node,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_until_node(control_build_context_T* context) {
  return (AST_NODE_T*) ast_erb_until_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->children,
    context->end_node,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_for_node(control_build_context_T* context) {
  return (AST_NODE_T*) ast_erb_for_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->children,
    context->end_node,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_block_node(control_build_context_T* context) {
  return (AST_NODE_T*) ast_erb_block_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->children,
    context->end_node,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_yield_node(control_build_context_T* context) {
  return (AST_NODE_T*) ast_erb_yield_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static bool control_type_in(control_type_t type, const control_type_t* list, size_t count) {
  if (!list) { return false; }

  for (size_t i = 0; i < count; i++) {
    if (type == list[i]) { return true; }
  }

  return false;
}

static AST_ERB_CONTENT_NODE_T* erb_content_at(hb_array_T* array, size_t index) {
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
  AST_ERB_CONTENT_NODE_T* erb_node = erb_content_at(array, index);

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

      if (stop_count > 0 && control_type_in(child_type, stop_types, stop_count)) { break; }
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
    end_erb->tag_closing->location.end,
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

  AST_ERB_CONTENT_NODE_T* candidate = erb_content_at(array, *index);

  if (!candidate) { return NULL; }

  control_type_t candidate_type = detect_control_type(candidate);

  if (!control_type_in(candidate_type, allowed_types, allowed_count)) { return NULL; }

  (*index)++;

  return build_end_node(candidate);
}

static bool is_control_with_children(control_type_t type) {
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

static size_t process_case_structure(
  AST_NODE_T* node,
  hb_array_T* array,
  size_t index,
  hb_array_T* output_array,
  analyze_ruby_context_T* context,
  control_type_t initial_type
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
    case CONTROL_TYPE_CASE_MATCH:
      return process_case_structure(node, array, index, output_array, context, initial_type);

    case CONTROL_TYPE_BEGIN: return process_begin_structure(node, array, index, output_array, context);

    default: return process_generic_structure(node, array, index, output_array, context, initial_type);
  }
}

static size_t process_case_structure(
  AST_NODE_T* node,
  hb_array_T* array,
  size_t index,
  hb_array_T* output_array,
  analyze_ruby_context_T* context,
  control_type_t initial_type
) {
  AST_ERB_CONTENT_NODE_T* erb_node = erb_content_at(array, index);
  if (!erb_node) { return index; }

  (void) initial_type;
  hb_array_T* when_conditions = hb_array_init(8);
  hb_array_T* in_conditions = hb_array_init(8);
  hb_array_T* non_when_non_in_children = hb_array_init(8);

  index++;

  const control_type_t prelude_stop[] = { CONTROL_TYPE_WHEN, CONTROL_TYPE_IN };
  collect_children_until(
    array,
    &index,
    non_when_non_in_children,
    prelude_stop,
    sizeof(prelude_stop) / sizeof(prelude_stop[0])
  );

  while (index < hb_array_size(array)) {
    AST_ERB_CONTENT_NODE_T* next_erb = erb_content_at(array, index);

    if (!next_erb) {
      AST_NODE_T* next_node = hb_array_get(array, index);

      if (!next_node) { break; }

      hb_array_append(non_when_non_in_children, next_node);
      index++;
      continue;
    }

    control_type_t next_type = detect_control_type(next_erb);

    if (next_type == CONTROL_TYPE_WHEN) {
      hb_array_T* when_statements = hb_array_init(8);
      index++;
      index = process_block_children(node, array, index, when_statements, context, CONTROL_TYPE_WHEN);

      hb_array_T* when_errors = next_erb->base.errors;
      next_erb->base.errors = NULL;

      AST_ERB_WHEN_NODE_T* when_node = ast_erb_when_node_init(
        next_erb->tag_opening,
        next_erb->content,
        next_erb->tag_closing,
        when_statements,
        next_erb->tag_opening->location.start,
        next_erb->tag_closing->location.end,
        when_errors
      );

      ast_node_free((AST_NODE_T*) next_erb);
      hb_array_append(when_conditions, (AST_NODE_T*) when_node);
      continue;
    }

    if (next_type == CONTROL_TYPE_IN) {
      hb_array_T* in_statements = hb_array_init(8);
      index++;
      index = process_block_children(node, array, index, in_statements, context, CONTROL_TYPE_IN);

      hb_array_T* in_errors = next_erb->base.errors;
      next_erb->base.errors = NULL;

      AST_ERB_IN_NODE_T* in_node = ast_erb_in_node_init(
        next_erb->tag_opening,
        next_erb->content,
        next_erb->tag_closing,
        in_statements,
        next_erb->tag_opening->location.start,
        next_erb->tag_closing->location.end,
        in_errors
      );

      ast_node_free((AST_NODE_T*) next_erb);
      hb_array_append(in_conditions, (AST_NODE_T*) in_node);
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

    const control_type_t else_stop[] = { CONTROL_TYPE_END };
    collect_children_until(array, &index, else_children, else_stop, sizeof(else_stop) / sizeof(else_stop[0]));

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

  const control_type_t end_types[] = { CONTROL_TYPE_END };
  AST_ERB_END_NODE_T* end_node = consume_end_node(array, &index, end_types, sizeof(end_types) / sizeof(end_types[0]));

  position_T start_position = erb_node->tag_opening->location.start;
  position_T end_position = erb_node->tag_closing->location.end;

  if (end_node) {
    end_position = end_node->base.location.end;
  } else if (else_clause) {
    end_position = else_clause->base.location.end;
  } else if (hb_array_size(when_conditions) > 0) {
    AST_NODE_T* last_when = hb_array_get(when_conditions, hb_array_size(when_conditions) - 1);
    end_position = last_when->location.end;
  } else if (hb_array_size(in_conditions) > 0) {
    AST_NODE_T* last_in = hb_array_get(in_conditions, hb_array_size(in_conditions) - 1);
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
  AST_ERB_CONTENT_NODE_T* erb_node = erb_content_at(array, index);
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

    const control_type_t else_stop[] = { CONTROL_TYPE_ENSURE, CONTROL_TYPE_END };
    collect_children_until(array, &index, else_children, else_stop, sizeof(else_stop) / sizeof(else_stop[0]));

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
      next_erb->tag_closing->location.end,
      ensure_errors
    );

    ast_node_free((AST_NODE_T*) next_erb);
  }

  const control_type_t end_types[] = { CONTROL_TYPE_END };
  AST_ERB_END_NODE_T* end_node = consume_end_node(array, &index, end_types, sizeof(end_types) / sizeof(end_types[0]));

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
  } else if (hb_array_size(children) > 0) {
    AST_NODE_T* last_child = hb_array_get(children, hb_array_size(children) - 1);
    end_position = last_child->location.end;
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
  AST_ERB_CONTENT_NODE_T* erb_node = erb_content_at(array, index);
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
  AST_ERB_CONTENT_NODE_T* erb_node = erb_content_at(array, index);

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

    if (is_control_with_children(child_type)) {
      hb_array_T* temp_array = hb_array_init(1);
      size_t new_index = process_control_structure(node, array, index, temp_array, context, child_type);

      if (hb_array_size(temp_array) > 0) { hb_array_append(children_array, hb_array_get(temp_array, 0)); }

      hb_array_free(&temp_array);

      index = new_index;
      continue;
    }

    hb_array_append(children_array, child);
    index++;
  }

  return index;
}

static hb_array_T* rewrite_node_array(AST_NODE_T* node, hb_array_T* array, analyze_ruby_context_T* context) {
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

    if (is_control_with_children(type)) {
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

static bool transform_erb_nodes(const AST_NODE_T* node, void* data) {
  analyze_ruby_context_T* context = (analyze_ruby_context_T*) data;
  context->parent = (AST_NODE_T*) node;

  if (node->type == AST_DOCUMENT_NODE) {
    AST_DOCUMENT_NODE_T* document_node = (AST_DOCUMENT_NODE_T*) node;
    hb_array_T* old_array = document_node->children;
    document_node->children = rewrite_node_array((AST_NODE_T*) node, document_node->children, context);
    hb_array_free(&old_array);
  }

  if (node->type == AST_HTML_ELEMENT_NODE) {
    AST_HTML_ELEMENT_NODE_T* element_node = (AST_HTML_ELEMENT_NODE_T*) node;
    hb_array_T* old_array = element_node->body;
    element_node->body = rewrite_node_array((AST_NODE_T*) node, element_node->body, context);
    hb_array_free(&old_array);
  }

  if (node->type == AST_HTML_OPEN_TAG_NODE) {
    AST_HTML_OPEN_TAG_NODE_T* open_tag = (AST_HTML_OPEN_TAG_NODE_T*) node;
    hb_array_T* old_array = open_tag->children;
    open_tag->children = rewrite_node_array((AST_NODE_T*) node, open_tag->children, context);
    hb_array_free(&old_array);
  }

  if (node->type == AST_HTML_ATTRIBUTE_VALUE_NODE) {
    AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node = (AST_HTML_ATTRIBUTE_VALUE_NODE_T*) node;
    hb_array_T* old_array = value_node->children;
    value_node->children = rewrite_node_array((AST_NODE_T*) node, value_node->children, context);
    hb_array_free(&old_array);
  }

  herb_visit_child_nodes(node, transform_erb_nodes, data);

  return false;
}

void herb_analyze_parse_tree(AST_DOCUMENT_NODE_T* document, const char* source) {
  herb_visit_node((AST_NODE_T*) document, analyze_erb_content, NULL);

  analyze_ruby_context_T* context = malloc(sizeof(analyze_ruby_context_T));
  context->document = document;
  context->parent = NULL;
  context->ruby_context_stack = hb_array_init(8);

  herb_visit_node((AST_NODE_T*) document, transform_erb_nodes, context);

  herb_analyze_parse_errors(document, source);

  hb_array_free(&context->ruby_context_stack);
  free(context);
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
