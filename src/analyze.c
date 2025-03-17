#include "include/analyze.h"
#include "include/analyzed_ruby_struct.h"
#include "include/array.h"
#include "include/ast_nodes.h"
#include "include/errors.h"
#include "include/extract.h"
#include "include/location.h"
#include "include/parser.h"
#include "include/position.h"
#include "include/ruby_parser.h"
#include "include/util.h"
#include "include/visitor.h"

#include <prism.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

position_T* position_from_source_with_offset(const char* source, size_t offset) {
  position_T* position = position_init(1, 0);

  for (size_t i = 0; i < offset; i++) {
    if (is_newline(source[i])) {
      position->line++;
      position->column = 0;
    } else {
      position->column++;
    }
  }

  return position;
}

static const char* pm_error_level_to_string(pm_error_level_t level) {
  switch (level) {
    case PM_ERROR_LEVEL_SYNTAX: return "syntax";
    case PM_ERROR_LEVEL_ARGUMENT: return "argument";
    case PM_ERROR_LEVEL_LOAD: return "load";
    default: return "Unknown pm_error_level_t";
  }
}

static RUBY_PARSE_ERROR_T* ruby_parse_error_from_prism_error(
  const pm_diagnostic_t* error, const AST_NODE_T* node, const char* source, pm_parser_t* parser
) {
  size_t start_offset = (size_t) (error->location.start - parser->start);
  size_t end_offset = (size_t) (error->location.end - parser->start);

  position_T* start = position_from_source_with_offset(source, start_offset);
  position_T* end = position_from_source_with_offset(source, end_offset);

  return ruby_parse_error_init(
    error->message,
    pm_diagnostic_id_human(error->diag_id),
    pm_error_level_to_string(error->level),
    start,
    end
  );
}

static analyzed_ruby_T* init_analyzed_ruby_T(char* source) {
  analyzed_ruby_T* analyzed = malloc(sizeof(analyzed_ruby_T));

  pm_parser_init(&analyzed->parser, (const uint8_t*) source, strlen(source), NULL);

  analyzed->root = pm_parse(&analyzed->parser);
  analyzed->valid = (analyzed->parser.error_list.size == 0);
  analyzed->parsed = true;
  analyzed->has_if_node = false;
  analyzed->has_elsif_node = false;
  analyzed->has_else_node = false;
  analyzed->has_end = false;
  analyzed->has_block_node = false;
  analyzed->has_case_node = false;
  analyzed->has_when_node = false;
  analyzed->has_for_node = false;
  analyzed->has_while_node = false;
  analyzed->has_until_node = false;
  analyzed->has_begin_node = false;
  analyzed->has_rescue_node = false;
  analyzed->has_ensure_node = false;

  return analyzed;
}

static bool has_if_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_if_node;
}

static bool has_elsif_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_elsif_node;
}

static bool has_else_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_else_node;
}

static bool has_end(analyzed_ruby_T* analyzed) {
  return analyzed->has_end;
}

// static bool has_block_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_block_node;
// }

// static bool has_case_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_case_node;
// }

// static bool has_when_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_when_node;
// }

// static bool has_for_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_for_node;
// }

// static bool has_while_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_while_node;
// }

// static bool has_until_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_until_node;
// }

// static bool has_begin_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_begin_node;
// }

// static bool has_rescue_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_rescue_node;
// }

// static bool has_ensure_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_ensure_node;
// }

static bool has_error_message(analyzed_ruby_T* anlayzed, const char* message) {
  for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) anlayzed->parser.error_list.head; error != NULL;
       error = (const pm_diagnostic_t*) error->node.next) {
    if (strcmp(error->message, message) == 0) { return true; }
  }

  return false;
}

static bool search_if_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_IF_NODE) {
    analyzed->has_if_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_if_nodes, analyzed);
  }

  return false;
}

static bool search_block_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_BLOCK_NODE) {
    analyzed->has_block_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_block_nodes, analyzed);
  }

  return false;
}

static bool search_case_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_CASE_MATCH_NODE) {
    analyzed->has_case_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_case_nodes, analyzed);
  }

  return false;
}

static bool search_while_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_WHILE_NODE) {
    analyzed->has_while_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_while_nodes, analyzed);
  }

  return false;
}

static bool search_for_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_FOR_NODE) {
    analyzed->has_for_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_for_nodes, analyzed);
  }

  return false;
}

static bool search_until_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_UNTIL_NODE) {
    analyzed->has_until_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_until_nodes, analyzed);
  }

  return false;
}

static bool search_begin_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_BEGIN_NODE) {
    analyzed->has_begin_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_begin_nodes, analyzed);
  }

  return false;
}

static bool search_elsif_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'elsif', ignoring it")) {
    analyzed->has_elsif_node = true;
    return true;
  }

  return false;
}

static bool search_else_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'else', ignoring it")) {
    analyzed->has_else_node = true;
    return true;
  }

  return false;
}

static bool search_end_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'end', ignoring it")) {
    analyzed->has_end = true;
    return true;
  }

  return false;
}

static bool search_when_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'when', ignoring it")) {
    analyzed->has_when_node = true;
    return true;
  }

  return false;
}

static bool search_rescue_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'rescue', ignoring it")) {
    analyzed->has_rescue_node = true;
    return true;
  }

  return false;
}

static bool search_ensure_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'ensure', ignoring it")) {
    analyzed->has_ensure_node = true;
    return true;
  }

  return false;
}

static analyzed_ruby_T* herb_analyze_ruby(char* source) {
  analyzed_ruby_T* analyzed = init_analyzed_ruby_T(source);

  pm_visit_node(analyzed->root, search_if_nodes, analyzed);
  pm_visit_node(analyzed->root, search_block_nodes, analyzed);
  pm_visit_node(analyzed->root, search_case_nodes, analyzed);
  pm_visit_node(analyzed->root, search_while_nodes, analyzed);
  pm_visit_node(analyzed->root, search_for_nodes, analyzed);
  pm_visit_node(analyzed->root, search_until_nodes, analyzed);
  pm_visit_node(analyzed->root, search_begin_nodes, analyzed);

  search_elsif_nodes(analyzed);
  search_else_nodes(analyzed);
  search_end_nodes(analyzed);
  search_when_nodes(analyzed);
  search_rescue_nodes(analyzed);
  search_ensure_nodes(analyzed);

  return analyzed;
}

static void pretty_print_analyed_ruby(analyzed_ruby_T* analyzed, const char* source) {
  printf(
    "------------------------\nanalyzed (%p)\n------------------------\n%s\n------------------------\n  if:     %i\n "
    " elsif:  %i\n  else:   %i\n  end:    %i\n  block:  %i\n  case:   %i\n  when:   %i\n  for:    %i\n  while:  %i\n "
    " until:  %i\n  begin:  %i\n  "
    "rescue: %i\n  ensure: %i\n==================\n\n",
    (void*) analyzed,
    source,
    analyzed->has_if_node,
    analyzed->has_elsif_node,
    analyzed->has_else_node,
    analyzed->has_end,
    analyzed->has_block_node,
    analyzed->has_case_node,
    analyzed->has_when_node,
    analyzed->has_for_node,
    analyzed->has_while_node,
    analyzed->has_until_node,
    analyzed->has_begin_node,
    analyzed->has_rescue_node,
    analyzed->has_ensure_node
  );
}

static bool analyze_erb_content(const AST_NODE_T* node, void* data) {
  if (node->type == AST_ERB_CONTENT_NODE) {
    AST_ERB_CONTENT_NODE_T* erb_content_node = (AST_ERB_CONTENT_NODE_T*) node;

    analyzed_ruby_T* analyzed = herb_analyze_ruby(erb_content_node->content->value);

    if (false) { pretty_print_analyed_ruby(analyzed, erb_content_node->content->value); }

    erb_content_node->parsed = true;
    erb_content_node->valid = analyzed->valid;
    erb_content_node->analyzed_ruby = analyzed;
  }

  herb_visit_child_nodes(node, analyze_erb_content, data);

  return false;
}

static size_t process_block_children(
  AST_NODE_T* node, array_T* array, size_t index, array_T* children_array, analyze_ruby_context_T* context
);

static size_t process_if_block(
  AST_NODE_T* node, array_T* array, size_t index, array_T* new_array, analyze_ruby_context_T* context
);

static size_t process_elsif_block(
  AST_NODE_T* node, array_T* array, size_t index, AST_NODE_T** subsequent_out, analyze_ruby_context_T* context
);

static size_t process_else_block(
  AST_NODE_T* node, array_T* array, size_t index, AST_NODE_T** subsequent_out, analyze_ruby_context_T* context
);

static size_t process_block_children(
  AST_NODE_T* node, array_T* array, size_t index, array_T* children_array, analyze_ruby_context_T* context
);

static size_t process_if_block(
  AST_NODE_T* node, array_T* array, size_t index, array_T* new_array, analyze_ruby_context_T* context
) {
  AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) array_get(array, index);

  array_T* if_children = array_init(8);

  index++;

  index = process_block_children(node, array, index, if_children, context);

  AST_NODE_T* subsequent = NULL;
  AST_ERB_END_NODE_T* end_node = NULL;
  AST_NODE_T* child = array_get(array, index);

  if (child && child->type == AST_ERB_CONTENT_NODE) {
    AST_ERB_CONTENT_NODE_T* erb_content = (AST_ERB_CONTENT_NODE_T*) child;

    if (has_elsif_node(erb_content->analyzed_ruby)) {
      index = process_elsif_block(node, array, index, &subsequent, context);
    } else if (has_else_node(erb_content->analyzed_ruby)) {
      index = process_else_block(node, array, index, &subsequent, context);
    }
  }

  child = array_get(array, index);

  if (child && child->type == AST_ERB_CONTENT_NODE) {
    AST_ERB_CONTENT_NODE_T* erb_content = (AST_ERB_CONTENT_NODE_T*) child;

    if (has_end(erb_content->analyzed_ruby)) {
      end_node = ast_erb_end_node_init(
        erb_content->tag_opening,
        erb_content->content,
        erb_content->tag_closing,
        erb_content->tag_opening->location->start,
        erb_content->tag_closing->location->end,
        erb_content->base.errors
      );

      index++;
    }
  }

  array_T* errors = array_init(8);

  location_T* end_location = (end_node != NULL) ? end_node->base.location : erb_node->tag_closing->location;

  AST_ERB_IF_NODE_T* if_node = ast_erb_if_node_init(
    erb_node->tag_opening,
    erb_node->content,
    erb_node->tag_closing,
    if_children,
    subsequent,
    end_node,
    erb_node->tag_opening->location->start,
    end_location->end,
    errors
  );

  array_append(new_array, (AST_NODE_T*) if_node);

  return index;
}

static size_t process_elsif_block(
  AST_NODE_T* node, array_T* array, size_t index, AST_NODE_T** subsequent_out, analyze_ruby_context_T* context
) {
  AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) array_get(array, index);

  array_T* elsif_children = array_init(8);

  index++;

  index = process_block_children(node, array, index, elsif_children, context);

  AST_NODE_T* last_child = array_last(elsif_children);
  location_T* end_location = (last_child != NULL) ? last_child->location : erb_node->tag_closing->location;

  AST_ERB_IF_NODE_T* elsif_node = ast_erb_if_node_init(
    erb_node->tag_opening,
    erb_node->content,
    erb_node->tag_closing,
    elsif_children,
    NULL,
    NULL,
    erb_node->tag_opening->location->start,
    end_location->end,
    array_init(8)
  );

  AST_NODE_T* child = array_get(array, index);
  if (child && child->type == AST_ERB_CONTENT_NODE) {
    AST_ERB_CONTENT_NODE_T* erb_content = (AST_ERB_CONTENT_NODE_T*) child;

    if (has_elsif_node(erb_content->analyzed_ruby)) {
      index = process_elsif_block(node, array, index, &(elsif_node->subsequent), context);
    } else if (has_else_node(erb_content->analyzed_ruby)) {
      index = process_else_block(node, array, index, &(elsif_node->subsequent), context);
    }
  }

  *subsequent_out = (AST_NODE_T*) elsif_node;
  return index;
}

static size_t process_else_block(
  AST_NODE_T* node, array_T* array, size_t index, AST_NODE_T** subsequent_out, analyze_ruby_context_T* context
) {
  AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) array_get(array, index);

  array_T* else_children = array_init(8);

  index++;

  index = process_block_children(node, array, index, else_children, context);

  AST_NODE_T* last_child = array_last(else_children);
  location_T* end_location = (last_child != NULL) ? last_child->location : erb_node->tag_closing->location;

  AST_ERB_ELSE_NODE_T* else_node = ast_erb_else_node_init(
    erb_node->tag_opening,
    erb_node->content,
    erb_node->tag_closing,
    else_children,
    erb_node->tag_opening->location->start,
    end_location->end,
    array_init(8)
  );

  *subsequent_out = (AST_NODE_T*) else_node;
  return index;
}

static size_t process_block_children(
  AST_NODE_T* node, array_T* array, size_t index, array_T* children_array, analyze_ruby_context_T* context
) {
  while (index < array_size(array)) {
    AST_NODE_T* child = array_get(array, index);

    if (!child) { break; }

    if (child->type != AST_ERB_CONTENT_NODE) {
      array_append(children_array, child);
      index++;
      continue;
    }

    AST_ERB_CONTENT_NODE_T* erb_content = (AST_ERB_CONTENT_NODE_T*) child;

    if (has_elsif_node(erb_content->analyzed_ruby) || has_else_node(erb_content->analyzed_ruby)
        || has_end(erb_content->analyzed_ruby)) {
      break;
    }

    if (!erb_content->analyzed_ruby->valid && has_if_node(erb_content->analyzed_ruby)) {
      array_T* temp_array = array_init(1);

      size_t new_index = process_if_block(node, array, index, temp_array, context);

      if (array_size(temp_array) > 0) { array_append(children_array, array_get(temp_array, 0)); }

      free(temp_array);

      index = new_index;
      continue;
    }

    array_append(children_array, child);
    index++;
  }

  return index;
}

static array_T* rewrite_node_array(AST_NODE_T* node, array_T* array, analyze_ruby_context_T* context) {
  array_T* new_array = array_init(array_size(array));
  size_t index = 0;

  while (index < array_size(array)) {
    AST_NODE_T* item = array_get(array, index);

    if (!item) { break; }

    if (item->type != AST_ERB_CONTENT_NODE) {
      array_append(new_array, item);
      index++;
      continue;
    }

    AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) item;

    if (erb_node->analyzed_ruby->valid) {
      array_append(new_array, item);
    } else {
      if (has_if_node(erb_node->analyzed_ruby)) {
        index = process_if_block(node, array, index, new_array, context);
        continue;
      }

      array_append(new_array, item);
    }

    index++;
  }

  return new_array;
}

static bool transform_erb_nodes(const AST_NODE_T* node, void* data) {
  analyze_ruby_context_T* context = (analyze_ruby_context_T*) data;
  context->parent = (AST_NODE_T*) node;

  if (node->type == AST_DOCUMENT_NODE) {
    AST_DOCUMENT_NODE_T* document_node = (AST_DOCUMENT_NODE_T*) node;
    document_node->children = rewrite_node_array((AST_NODE_T*) node, document_node->children, context);
  }

  if (node->type == AST_HTML_ELEMENT_NODE) {
    AST_HTML_ELEMENT_NODE_T* element_node = (AST_HTML_ELEMENT_NODE_T*) node;
    element_node->body = rewrite_node_array((AST_NODE_T*) node, element_node->body, context);
  }

  if (node->type == AST_HTML_OPEN_TAG_NODE) {
    AST_HTML_OPEN_TAG_NODE_T* open_tag = (AST_HTML_OPEN_TAG_NODE_T*) node;
    open_tag->children = rewrite_node_array((AST_NODE_T*) node, open_tag->children, context);
  }

  if (node->type == AST_HTML_ATTRIBUTE_VALUE_NODE) {
    AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node = (AST_HTML_ATTRIBUTE_VALUE_NODE_T*) node;
    value_node->children = rewrite_node_array((AST_NODE_T*) node, value_node->children, context);
  }

  herb_visit_child_nodes(node, transform_erb_nodes, data);

  return false;
}

void herb_analyze_parse_tree(AST_DOCUMENT_NODE_T* document, const char* source) {
  herb_visit_node((AST_NODE_T*) document, analyze_erb_content, NULL);

  analyze_ruby_context_T* context = malloc(sizeof(analyze_ruby_context_T));
  context->document = document;
  context->parent = NULL;
  context->ruby_context_stack = array_init(8);

  herb_visit_node((AST_NODE_T*) document, transform_erb_nodes, context);

  herb_analyze_parse_errors(document, source);

  free(context);
}

void herb_analyze_parse_errors(AST_DOCUMENT_NODE_T* document, const char* source) {
  char* extracted_ruby = herb_extract_ruby_with_semicolons(source);

  pm_parser_t parser;
  pm_parser_init(&parser, (const uint8_t*) extracted_ruby, strlen(extracted_ruby), NULL);

  pm_parse(&parser);

  for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) parser.error_list.head; error != NULL;
       error = (const pm_diagnostic_t*) error->node.next) {
    array_append(
      document->base.errors,
      ruby_parse_error_from_prism_error(error, (AST_NODE_T*) document, source, &parser)
    );
  }
}
