#include "include/prism_helpers.h"
#include "include/ast_nodes.h"
#include "include/errors.h"
#include "include/location.h"
#include "include/position.h"
#include "include/util/hb_buffer.h"

#include <prism.h>
#include <stdlib.h>
#include <string.h>

const char* pm_error_level_to_string(pm_error_level_t level) {
  switch (level) {
    case PM_ERROR_LEVEL_SYNTAX: return "syntax";
    case PM_ERROR_LEVEL_ARGUMENT: return "argument";
    case PM_ERROR_LEVEL_LOAD: return "load";

    default: return "Unknown pm_error_level_t";
  }
}

RUBY_PARSE_ERROR_T* ruby_parse_error_from_prism_error(
  const pm_diagnostic_t* error,
  const AST_NODE_T* node,
  const char* source,
  pm_parser_t* parser
) {
  size_t start_offset = (size_t) (error->location.start - parser->start);
  size_t end_offset = (size_t) (error->location.end - parser->start);

  position_T start = position_from_source_with_offset(source, start_offset);
  position_T end = position_from_source_with_offset(source, end_offset);

  return ruby_parse_error_init(
    error->message,
    pm_diagnostic_id_human(error->diag_id),
    pm_error_level_to_string(error->level),
    start,
    end,
    NULL
  );
}

RUBY_PARSE_ERROR_T* ruby_parse_error_from_prism_error_with_positions(
  const pm_diagnostic_t* error,
  position_T start,
  position_T end
) {
  return ruby_parse_error_init(
    error->message,
    pm_diagnostic_id_human(error->diag_id),
    pm_error_level_to_string(error->level),
    start,
    end,
    NULL
  );
}

typedef struct {
  pm_location_t then_keyword_loc;
  bool found;
} then_keyword_search_context_T;

static bool has_pm_location(pm_location_t location) {
  return location.start != NULL && location.end != NULL && (location.end - location.start) > 0;
}

static bool search_then_keyword_location(const pm_node_t* node, void* data) {
  then_keyword_search_context_T* context = (then_keyword_search_context_T*) data;

  if (context->found) { return false; }

  switch (node->type) {
    case PM_IF_NODE: {
      const pm_if_node_t* if_node = (const pm_if_node_t*) node;
      if (has_pm_location(if_node->then_keyword_loc)) {
        context->then_keyword_loc = if_node->then_keyword_loc;
        context->found = true;
        return false;
      }
      break;
    }

    case PM_UNLESS_NODE: {
      const pm_unless_node_t* unless_node = (const pm_unless_node_t*) node;
      if (has_pm_location(unless_node->then_keyword_loc)) {
        context->then_keyword_loc = unless_node->then_keyword_loc;
        context->found = true;
        return false;
      }
      break;
    }

    case PM_WHEN_NODE: {
      const pm_when_node_t* when_node = (const pm_when_node_t*) node;
      if (has_pm_location(when_node->then_keyword_loc)) {
        context->then_keyword_loc = when_node->then_keyword_loc;
        context->found = true;
        return false;
      }
      break;
    }

    case PM_IN_NODE: {
      const pm_in_node_t* in_node = (const pm_in_node_t*) node;
      if (has_pm_location(in_node->then_loc)) {
        context->then_keyword_loc = in_node->then_loc;
        context->found = true;
        return false;
      }
      break;
    }

    default: break;
  }

  pm_visit_child_nodes(node, search_then_keyword_location, context);

  return false;
}

location_T* get_then_keyword_location(analyzed_ruby_T* analyzed, const char* source) {
  if (analyzed == NULL || analyzed->root == NULL || source == NULL) { return NULL; }

  then_keyword_search_context_T context = { .then_keyword_loc = { .start = NULL, .end = NULL }, .found = false };

  pm_visit_child_nodes(analyzed->root, search_then_keyword_location, &context);

  if (!context.found) { return NULL; }

  size_t start_offset = (size_t) (context.then_keyword_loc.start - analyzed->parser.start);
  size_t end_offset = (size_t) (context.then_keyword_loc.end - analyzed->parser.start);

  position_T start_position = position_from_source_with_offset(source, start_offset);
  position_T end_position = position_from_source_with_offset(source, end_offset);

  return location_create(start_position, end_position);
}

static location_T* parse_wrapped_and_find_then_keyword(
  hb_buffer_T* buffer,
  const char* source,
  size_t source_length,
  size_t prefix_length,
  size_t adjustment_threshold,
  size_t adjustment_amount
) {
  pm_parser_t parser;
  pm_parser_init(&parser, (const uint8_t*) hb_buffer_value(buffer), hb_buffer_length(buffer), NULL);
  pm_node_t* root = pm_parse(&parser);

  if (root == NULL) {
    pm_parser_free(&parser);

    return NULL;
  }

  then_keyword_search_context_T context = { .then_keyword_loc = { .start = NULL, .end = NULL }, .found = false };

  pm_visit_child_nodes(root, search_then_keyword_location, &context);

  location_T* location = NULL;

  if (context.found) {
    size_t start_offset = (size_t) (context.then_keyword_loc.start - parser.start);
    size_t end_offset = (size_t) (context.then_keyword_loc.end - parser.start);

    if (start_offset >= prefix_length && end_offset >= prefix_length) {
      start_offset -= prefix_length;
      end_offset -= prefix_length;

      if (start_offset > adjustment_threshold) {
        start_offset += adjustment_amount;
        end_offset += adjustment_amount;
      }

      if (start_offset <= source_length && end_offset <= source_length) {
        position_T start_position = position_from_source_with_offset(source, start_offset);
        position_T end_position = position_from_source_with_offset(source, end_offset);

        location = location_create(start_position, end_position);
      }
    }
  }

  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);

  return location;
}

location_T* get_then_keyword_location_wrapped(const char* source, bool is_in_clause) {
  if (source == NULL) { return NULL; }

  size_t source_length = strlen(source);

  hb_buffer_T buffer;

  if (!hb_buffer_init(&buffer, source_length + 16)) { return NULL; }

  hb_buffer_append(&buffer, "case x\n");
  size_t prefix_length = hb_buffer_length(&buffer);
  hb_buffer_append(&buffer, source);
  hb_buffer_append(&buffer, "\nend");

  location_T* location =
    parse_wrapped_and_find_then_keyword(&buffer, source, source_length, prefix_length, SIZE_MAX, 0);

  free(buffer.value);

  return location;
}

location_T* get_then_keyword_location_elsif_wrapped(const char* source) {
  if (source == NULL) { return NULL; }

  const char* elsif_position = strstr(source, "elsif");

  if (elsif_position == NULL) { return NULL; }

  size_t source_length = strlen(source);
  size_t elsif_offset = (size_t) (elsif_position - source);
  size_t replacement_diff = strlen("elsif") - strlen("if");

  hb_buffer_T buffer;

  if (!hb_buffer_init(&buffer, source_length + 8)) { return NULL; }

  hb_buffer_append_with_length(&buffer, source, elsif_offset);
  hb_buffer_append(&buffer, "if");
  size_t if_end_offset = hb_buffer_length(&buffer);
  hb_buffer_append(&buffer, source + elsif_offset + strlen("elsif"));
  hb_buffer_append(&buffer, "\nend");

  location_T* location =
    parse_wrapped_and_find_then_keyword(&buffer, source, source_length, 0, if_end_offset, replacement_diff);

  free(buffer.value);

  return location;
}
