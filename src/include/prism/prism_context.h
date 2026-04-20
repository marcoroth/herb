#ifndef HERB_PRISM_CONTEXT_H
#define HERB_PRISM_CONTEXT_H

#include "../lib/hb_allocator.h"
#include "../lib/hb_buffer.h"
#include <prism.h>
#include <stdbool.h>

typedef struct {
  pm_parser_t parser;
  pm_options_t pm_opts;
  pm_node_t* root;
  hb_buffer_T ruby_buf;

  bool has_structural;
  pm_parser_t structural_parser;
  pm_options_t structural_pm_opts;
  pm_node_t* structural_root;
  hb_buffer_T structural_buf;

  hb_allocator_T* allocator;
} herb_prism_context_T;

static inline void herb_prism_context_free(herb_prism_context_T* context) {
  if (!context) { return; }

  if (context->root) { pm_node_destroy(&context->parser, context->root); }

  pm_parser_free(&context->parser);
  pm_options_free(&context->pm_opts);
  hb_buffer_free(&context->ruby_buf);

  if (context->has_structural) {
    if (context->structural_root) { pm_node_destroy(&context->structural_parser, context->structural_root); }

    pm_parser_free(&context->structural_parser);
    pm_options_free(&context->structural_pm_opts);

    if (context->structural_buf.value) { hb_buffer_free(&context->structural_buf); }
  }

  hb_allocator_dealloc(context->allocator, context);
}

#endif
