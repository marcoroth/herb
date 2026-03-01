#include "../include/analyze/builders.h"
#include "../include/analyze/analyze.h"
#include "../include/ast_nodes.h"
#include "../include/location.h"
#include "../include/position.h"
#include "../include/prism_helpers.h"
#include "../include/token_struct.h"
#include "../include/util/hb_array.h"

#include <stddef.h>
#include <string.h>

position_T erb_content_end_position(const AST_ERB_CONTENT_NODE_T* erb_node) {
  if (erb_node->tag_closing != NULL) {
    return erb_node->tag_closing->location.end;
  } else if (erb_node->content != NULL) {
    return erb_node->content->location.end;
  } else {
    return erb_node->tag_opening->location.end;
  }
}

location_T* compute_then_keyword(AST_ERB_CONTENT_NODE_T* erb_node, control_type_t control_type) {
  if (control_type != CONTROL_TYPE_IF && control_type != CONTROL_TYPE_ELSIF && control_type != CONTROL_TYPE_UNLESS
      && control_type != CONTROL_TYPE_WHEN && control_type != CONTROL_TYPE_IN) {
    return NULL;
  }

  token_T* content = erb_node->content;
  const char* source = content ? content->value : NULL;
  location_T* then_keyword = NULL;

  if (control_type == CONTROL_TYPE_WHEN || control_type == CONTROL_TYPE_IN) {
    if (source != NULL && strstr(source, "then") != NULL) {
      then_keyword = get_then_keyword_location_wrapped(source, control_type == CONTROL_TYPE_IN);
    }
  } else if (control_type == CONTROL_TYPE_ELSIF) {
    if (source != NULL && strstr(source, "then") != NULL) {
      then_keyword = get_then_keyword_location_elsif_wrapped(source);
    }
  } else {
    then_keyword = get_then_keyword_location(erb_node->analyzed_ruby, source);
  }

  if (then_keyword != NULL && content != NULL) {
    position_T content_start = content->location.start;

    then_keyword->start.line = content_start.line + then_keyword->start.line - 1;
    then_keyword->start.column = content_start.column + then_keyword->start.column;
    then_keyword->end.line = content_start.line + then_keyword->end.line - 1;
    then_keyword->end.column = content_start.column + then_keyword->end.column;
  }

  return then_keyword;
}

typedef struct {
  AST_ERB_CONTENT_NODE_T* erb;
  hb_array_T* children;
  AST_NODE_T* subsequent;
  AST_ERB_END_NODE_T* end_node;
  token_T* tag_opening;
  token_T* content;
  token_T* tag_closing;
  location_T* then_keyword;
  position_T start_position;
  position_T end_position;
  hb_array_T* errors;
  control_type_t control_type;
} control_builder_context_T;

typedef AST_NODE_T* (*control_builder_fn)(control_builder_context_T* context);

typedef struct {
  control_type_t type;
  control_builder_fn builder;
} control_builder_entry_T;

static AST_NODE_T* build_if_node(control_builder_context_T* context);
static AST_NODE_T* build_else_node(control_builder_context_T* context);
static AST_NODE_T* build_when_node(control_builder_context_T* context);
static AST_NODE_T* build_in_node(control_builder_context_T* context);
static AST_NODE_T* build_rescue_node(control_builder_context_T* context);
static AST_NODE_T* build_ensure_node(control_builder_context_T* context);
static AST_NODE_T* build_unless_node(control_builder_context_T* context);
static AST_NODE_T* build_while_node(control_builder_context_T* context);
static AST_NODE_T* build_until_node(control_builder_context_T* context);
static AST_NODE_T* build_for_node(control_builder_context_T* context);
static AST_NODE_T* build_block_node(control_builder_context_T* context);
static AST_NODE_T* build_yield_node(control_builder_context_T* context);

static const control_builder_entry_T CONTROL_BUILDERS[] = {
  { CONTROL_TYPE_IF, build_if_node },         { CONTROL_TYPE_ELSIF, build_if_node },
  { CONTROL_TYPE_ELSE, build_else_node },     { CONTROL_TYPE_WHEN, build_when_node },
  { CONTROL_TYPE_IN, build_in_node },         { CONTROL_TYPE_RESCUE, build_rescue_node },
  { CONTROL_TYPE_ENSURE, build_ensure_node }, { CONTROL_TYPE_UNLESS, build_unless_node },
  { CONTROL_TYPE_WHILE, build_while_node },   { CONTROL_TYPE_UNTIL, build_until_node },
  { CONTROL_TYPE_FOR, build_for_node },       { CONTROL_TYPE_BLOCK, build_block_node },
  { CONTROL_TYPE_YIELD, build_yield_node },
};

static control_builder_fn lookup_control_builder(control_type_t type) {
  for (size_t i = 0; i < sizeof(CONTROL_BUILDERS) / sizeof(CONTROL_BUILDERS[0]); i++) {
    if (CONTROL_BUILDERS[i].type == type) { return CONTROL_BUILDERS[i].builder; }
  }

  return NULL;
}

AST_NODE_T* create_control_node(
  AST_ERB_CONTENT_NODE_T* erb_node,
  hb_array_T* children,
  AST_NODE_T* subsequent,
  AST_ERB_END_NODE_T* end_node,
  control_type_t control_type
) {
  control_builder_context_T context = { .erb = erb_node,
                                        .children = children,
                                        .subsequent = subsequent,
                                        .end_node = end_node,
                                        .tag_opening = erb_node->tag_opening,
                                        .content = erb_node->content,
                                        .tag_closing = erb_node->tag_closing,
                                        .then_keyword = compute_then_keyword(erb_node, control_type),
                                        .start_position = erb_node->tag_opening->location.start,
                                        .end_position = erb_content_end_position(erb_node),
                                        .errors = erb_node->base.errors,
                                        .control_type = control_type };

  erb_node->base.errors = NULL;

  if (context.end_node) {
    context.end_position = context.end_node->base.location.end;
  } else if (hb_array_size(context.children) > 0) {
    AST_NODE_T* last_child = hb_array_last(context.children);
    context.end_position = last_child->location.end;
  } else if (context.subsequent) {
    context.end_position = context.subsequent->location.end;
  }

  control_builder_fn builder = lookup_control_builder(control_type);

  if (!builder) { return NULL; }

  return builder(&context);
}

static AST_NODE_T* build_if_node(control_builder_context_T* context) {
  return (AST_NODE_T*) ast_erb_if_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->then_keyword,
    context->children,
    context->subsequent,
    context->end_node,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_else_node(control_builder_context_T* context) {
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

static AST_NODE_T* build_when_node(control_builder_context_T* context) {
  return (AST_NODE_T*) ast_erb_when_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->then_keyword,
    context->children,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_in_node(control_builder_context_T* context) {
  return (AST_NODE_T*) ast_erb_in_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->then_keyword,
    context->children,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_rescue_node(control_builder_context_T* context) {
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

static AST_NODE_T* build_ensure_node(control_builder_context_T* context) {
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

static AST_NODE_T* build_unless_node(control_builder_context_T* context) {
  AST_ERB_ELSE_NODE_T* else_clause = NULL;

  if (context->subsequent && context->subsequent->type == AST_ERB_ELSE_NODE) {
    else_clause = (AST_ERB_ELSE_NODE_T*) context->subsequent;
  }

  return (AST_NODE_T*) ast_erb_unless_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->then_keyword,
    context->children,
    else_clause,
    context->end_node,
    context->start_position,
    context->end_position,
    context->errors
  );
}

static AST_NODE_T* build_while_node(control_builder_context_T* context) {
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

static AST_NODE_T* build_until_node(control_builder_context_T* context) {
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

static AST_NODE_T* build_for_node(control_builder_context_T* context) {
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

static AST_NODE_T* build_block_node(control_builder_context_T* context) {
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

static AST_NODE_T* build_yield_node(control_builder_context_T* context) {
  return (AST_NODE_T*) ast_erb_yield_node_init(
    context->tag_opening,
    context->content,
    context->tag_closing,
    context->start_position,
    context->end_position,
    context->errors
  );
}
