#include "../include/analyze/prism_annotate.h"
#include "../include/ast_node.h"
#include "../include/ast_nodes.h"
#include "../include/extract.h"
#include "../include/herb_prism_node.h"
#include "../include/prism_context.h"
#include "../include/util/hb_allocator.h"
#include "../include/util/hb_buffer.h"
#include "../include/util/hb_narray.h"
#include "../include/visitor.h"

#include <prism.h>
#include <string.h>

typedef struct {
  uint32_t from;
  uint32_t to;
} content_range_T;

typedef struct {
  pm_parser_t* parser;
  pm_parser_t* structural_parser;
  hb_narray_T* node_list;
  hb_narray_T* structural_node_list;
  bool prism_nodes_deep;
} prism_annotate_context_T;

static void collect_prism_nodes(pm_node_t* node, hb_narray_T* list);

static void collect_from_statements(pm_statements_node_t* statements, hb_narray_T* list) {
  if (!statements) { return; }

  for (size_t i = 0; i < statements->body.size; i++) {
    hb_narray_push(list, &statements->body.nodes[i]);
    collect_prism_nodes(statements->body.nodes[i], list);
  }
}

static void collect_prism_nodes(pm_node_t* node, hb_narray_T* list) {
  if (!node) { return; }

  switch (PM_NODE_TYPE(node)) {
    case PM_PROGRAM_NODE: {
      collect_from_statements(((pm_program_node_t*) node)->statements, list);
      break;
    }

    case PM_IF_NODE: {
      pm_if_node_t* if_node = (pm_if_node_t*) node;
      collect_from_statements(if_node->statements, list);
      if (if_node->subsequent) { collect_prism_nodes(if_node->subsequent, list); }
      break;
    }

    case PM_UNLESS_NODE: {
      pm_unless_node_t* unless_node = (pm_unless_node_t*) node;
      collect_from_statements(unless_node->statements, list);
      if (unless_node->else_clause) { collect_prism_nodes((pm_node_t*) unless_node->else_clause, list); }
      break;
    }

    case PM_ELSE_NODE: {
      collect_from_statements(((pm_else_node_t*) node)->statements, list);
      break;
    }

    case PM_WHILE_NODE: {
      collect_from_statements(((pm_while_node_t*) node)->statements, list);
      break;
    }

    case PM_UNTIL_NODE: {
      collect_from_statements(((pm_until_node_t*) node)->statements, list);
      break;
    }

    case PM_FOR_NODE: {
      collect_from_statements(((pm_for_node_t*) node)->statements, list);
      break;
    }

    case PM_CASE_NODE: {
      pm_case_node_t* case_node = (pm_case_node_t*) node;

      for (size_t i = 0; i < case_node->conditions.size; i++) {
        collect_prism_nodes(case_node->conditions.nodes[i], list);
      }

      if (case_node->else_clause) { collect_prism_nodes((pm_node_t*) case_node->else_clause, list); }
      break;
    }

    case PM_CASE_MATCH_NODE: {
      pm_case_match_node_t* case_match_node = (pm_case_match_node_t*) node;

      for (size_t i = 0; i < case_match_node->conditions.size; i++) {
        collect_prism_nodes(case_match_node->conditions.nodes[i], list);
      }

      if (case_match_node->else_clause) { collect_prism_nodes((pm_node_t*) case_match_node->else_clause, list); }
      break;
    }

    case PM_WHEN_NODE: {
      collect_from_statements(((pm_when_node_t*) node)->statements, list);
      break;
    }

    case PM_IN_NODE: {
      collect_from_statements(((pm_in_node_t*) node)->statements, list);
      break;
    }

    case PM_BEGIN_NODE: {
      pm_begin_node_t* begin_node = (pm_begin_node_t*) node;

      collect_from_statements(begin_node->statements, list);

      if (begin_node->rescue_clause) { collect_prism_nodes((pm_node_t*) begin_node->rescue_clause, list); }
      if (begin_node->else_clause) { collect_prism_nodes((pm_node_t*) begin_node->else_clause, list); }
      if (begin_node->ensure_clause) { collect_prism_nodes((pm_node_t*) begin_node->ensure_clause, list); }

      break;
    }

    case PM_RESCUE_NODE: {
      pm_rescue_node_t* rescue_node = (pm_rescue_node_t*) node;

      collect_from_statements(rescue_node->statements, list);

      if (rescue_node->subsequent) { collect_prism_nodes((pm_node_t*) rescue_node->subsequent, list); }
      break;
    }

    case PM_ENSURE_NODE: {
      collect_from_statements(((pm_ensure_node_t*) node)->statements, list);
      break;
    }

    case PM_CALL_NODE: {
      pm_call_node_t* call_node = (pm_call_node_t*) node;

      if (call_node->block && PM_NODE_TYPE(call_node->block) == PM_BLOCK_NODE) {
        pm_block_node_t* block = (pm_block_node_t*) call_node->block;

        if (block->body && PM_NODE_TYPE(block->body) == PM_STATEMENTS_NODE) {
          collect_from_statements((pm_statements_node_t*) block->body, list);
        }
      }

      break;
    }

    case PM_LAMBDA_NODE: {
      pm_lambda_node_t* lambda_node = (pm_lambda_node_t*) node;

      if (lambda_node->body && PM_NODE_TYPE(lambda_node->body) == PM_STATEMENTS_NODE) {
        collect_from_statements((pm_statements_node_t*) lambda_node->body, list);
      }

      break;
    }

    default: break;
  }
}

static token_T* get_content_token(const AST_NODE_T* node) {
  switch (node->type) {
    case AST_ERB_CONTENT_NODE: return ((AST_ERB_CONTENT_NODE_T*) node)->content;
    case AST_ERB_RENDER_NODE: return ((AST_ERB_RENDER_NODE_T*) node)->content;
    case AST_ERB_IF_NODE: return ((AST_ERB_IF_NODE_T*) node)->content;
    case AST_ERB_BLOCK_NODE: return ((AST_ERB_BLOCK_NODE_T*) node)->content;
    case AST_ERB_CASE_NODE: return ((AST_ERB_CASE_NODE_T*) node)->content;
    case AST_ERB_CASE_MATCH_NODE: return ((AST_ERB_CASE_MATCH_NODE_T*) node)->content;
    case AST_ERB_WHILE_NODE: return ((AST_ERB_WHILE_NODE_T*) node)->content;
    case AST_ERB_UNTIL_NODE: return ((AST_ERB_UNTIL_NODE_T*) node)->content;
    case AST_ERB_FOR_NODE: return ((AST_ERB_FOR_NODE_T*) node)->content;
    case AST_ERB_BEGIN_NODE: return ((AST_ERB_BEGIN_NODE_T*) node)->content;
    case AST_ERB_UNLESS_NODE: return ((AST_ERB_UNLESS_NODE_T*) node)->content;
    default: return NULL;
  }
}

static void set_prism_node(AST_NODE_T* node, herb_prism_node_T prism_ref) {
  switch (node->type) {
    case AST_ERB_CONTENT_NODE: ((AST_ERB_CONTENT_NODE_T*) node)->prism_node = prism_ref; break;
    case AST_ERB_RENDER_NODE: ((AST_ERB_RENDER_NODE_T*) node)->prism_node = prism_ref; break;
    case AST_ERB_IF_NODE: ((AST_ERB_IF_NODE_T*) node)->prism_node = prism_ref; break;
    case AST_ERB_BLOCK_NODE: ((AST_ERB_BLOCK_NODE_T*) node)->prism_node = prism_ref; break;
    case AST_ERB_CASE_NODE: ((AST_ERB_CASE_NODE_T*) node)->prism_node = prism_ref; break;
    case AST_ERB_CASE_MATCH_NODE: ((AST_ERB_CASE_MATCH_NODE_T*) node)->prism_node = prism_ref; break;
    case AST_ERB_WHILE_NODE: ((AST_ERB_WHILE_NODE_T*) node)->prism_node = prism_ref; break;
    case AST_ERB_UNTIL_NODE: ((AST_ERB_UNTIL_NODE_T*) node)->prism_node = prism_ref; break;
    case AST_ERB_FOR_NODE: ((AST_ERB_FOR_NODE_T*) node)->prism_node = prism_ref; break;
    case AST_ERB_BEGIN_NODE: ((AST_ERB_BEGIN_NODE_T*) node)->prism_node = prism_ref; break;
    case AST_ERB_UNLESS_NODE: ((AST_ERB_UNLESS_NODE_T*) node)->prism_node = prism_ref; break;
    default: break;
  }
}

static herb_prism_node_T find_prism_node_for_herb_node(
  pm_parser_t* parser,
  hb_narray_T* node_list,
  const AST_NODE_T* node
) {
  herb_prism_node_T result = HERB_PRISM_NODE_EMPTY;

  token_T* content = get_content_token(node);
  if (!content || hb_string_is_empty(content->value)) { return result; }

  uint32_t content_from = content->range.from;
  uint32_t content_to = content->range.to;

  for (size_t i = 0; i < hb_narray_size(node_list); i++) {
    pm_node_t* prism_node = *(pm_node_t**) hb_narray_get(node_list, i);
    size_t prism_start = (size_t) (prism_node->location.start - parser->start);

    if (prism_start >= content_from && prism_start < content_to) {
      result.node = prism_node;
      result.parser = parser;
      break;
    }
  }

  return result;
}

static bool annotate_visitor(const AST_NODE_T* node, void* data) {
  prism_annotate_context_T* context = (prism_annotate_context_T*) data;

  if (!get_content_token(node)) { return true; }

  pm_parser_t* parser;
  hb_narray_T* node_list;

  if (node->type == AST_ERB_CONTENT_NODE || node->type == AST_ERB_RENDER_NODE || context->prism_nodes_deep) {
    parser = context->parser;
    node_list = context->node_list;
  } else {
    parser = context->structural_parser;
    node_list = context->structural_node_list;
  }

  herb_prism_node_T prism_ref = find_prism_node_for_herb_node(parser, node_list, node);

  if (prism_ref.node) { set_prism_node((AST_NODE_T*) node, prism_ref); }

  return true;
}

static bool collect_content_ranges_visitor(const AST_NODE_T* node, void* data) {
  if (node->type != AST_ERB_CONTENT_NODE && node->type != AST_ERB_RENDER_NODE) { return true; }

  hb_narray_T* ranges = (hb_narray_T*) data;
  token_T* content = get_content_token(node);

  if (!content || hb_string_is_empty(content->value)) { return true; }

  content_range_T range = { .from = content->range.from, .to = content->range.to };
  hb_narray_push(ranges, &range);

  return true;
}

void herb_annotate_prism_nodes(
  AST_DOCUMENT_NODE_T* document,
  const char* source,
  bool prism_nodes,
  bool prism_nodes_deep,
  bool prism_program,
  hb_allocator_T* allocator
) {
  if (!document || !source) { return; }

  size_t source_len = strlen(source);

  herb_prism_context_T* context = hb_allocator_alloc(allocator, sizeof(herb_prism_context_T));
  if (!context) { return; }

  memset(context, 0, sizeof(herb_prism_context_T));

  context->allocator = allocator;
  context->has_structural = false;

  if (!hb_buffer_init(&context->ruby_buf, source_len, allocator)) {
    hb_allocator_dealloc(allocator, context);
    return;
  }

  herb_extract_ruby_options_T extract_options = {
    .semicolons = true,
    .comments = false,
    .preserve_positions = true,
  };

  herb_extract_ruby_to_buffer_with_options(source, &context->ruby_buf, &extract_options, allocator);

  if (!context->ruby_buf.value || context->ruby_buf.length == 0) {
    hb_buffer_free(&context->ruby_buf);
    hb_allocator_dealloc(allocator, context);
    return;
  }

  memset(&context->pm_opts, 0, sizeof(pm_options_t));
  pm_options_partial_script_set(&context->pm_opts, true);
  pm_parser_init(
    &context->parser,
    (const uint8_t*) context->ruby_buf.value,
    context->ruby_buf.length,
    &context->pm_opts
  );
  context->root = pm_parse(&context->parser);

  if (!context->root || context->root->type != PM_PROGRAM_NODE) {
    pm_node_destroy(&context->parser, context->root);
    context->root = NULL;

    pm_parser_free(&context->parser);
    pm_options_free(&context->pm_opts);

    hb_buffer_free(&context->ruby_buf);
    hb_allocator_dealloc(allocator, context);

    return;
  }

  document->prism_context = context;

  if (prism_program) {
    herb_prism_node_T program_ref = {
      .node = context->root,
      .parser = &context->parser,
    };

    document->prism_node = program_ref;
  }

  hb_narray_T node_list;
  hb_narray_pointer_init(&node_list, 32, allocator);

  hb_narray_T structural_node_list;
  hb_narray_pointer_init(&structural_node_list, 32, allocator);

  if (prism_nodes) {
    collect_prism_nodes(context->root, &node_list);

    if (!prism_nodes_deep) {
      hb_narray_T content_ranges;
      hb_narray_init(&content_ranges, sizeof(content_range_T), 32, allocator);
      herb_visit_node((AST_NODE_T*) document, collect_content_ranges_visitor, &content_ranges);

      if (hb_buffer_init(&context->structural_buf, context->ruby_buf.length, allocator)) {
        memcpy(context->structural_buf.value, context->ruby_buf.value, context->ruby_buf.length);
        context->structural_buf.length = context->ruby_buf.length;

        for (size_t i = 0; i < hb_narray_size(&content_ranges); i++) {
          content_range_T* range = (content_range_T*) hb_narray_get(&content_ranges, i);

          for (uint32_t j = range->from; j < range->to && j < context->structural_buf.length; j++) {
            context->structural_buf.value[j] = ' ';
          }
        }

        memset(&context->structural_pm_opts, 0, sizeof(pm_options_t));
        pm_options_partial_script_set(&context->structural_pm_opts, true);

        pm_parser_init(
          &context->structural_parser,
          (const uint8_t*) context->structural_buf.value,
          context->structural_buf.length,
          &context->structural_pm_opts
        );

        context->structural_root = pm_parse(&context->structural_parser);
        context->has_structural = true;

        if (context->structural_root && context->structural_root->type == PM_PROGRAM_NODE) {
          collect_prism_nodes(context->structural_root, &structural_node_list);
        }
      }

      hb_narray_deinit(&content_ranges);
    }

    prism_annotate_context_T annotate_context = {
      .parser = &context->parser,
      .structural_parser = prism_nodes_deep ? &context->parser : &context->structural_parser,
      .node_list = &node_list,
      .structural_node_list = prism_nodes_deep ? &node_list : &structural_node_list,
      .prism_nodes_deep = prism_nodes_deep,
    };

    herb_visit_node((AST_NODE_T*) document, annotate_visitor, &annotate_context);
  }

  hb_narray_deinit(&node_list);
  hb_narray_deinit(&structural_node_list);
}
