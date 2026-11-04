#include "../include/prism/prism_helpers.h"
#include "../include/ast/ast_nodes.h"
#include "../include/errors.h"
#include "../include/lib/hb_buffer.h"
#include "../include/lib/hb_string.h"
#include "../include/location/location.h"
#include "../include/location/position.h"

#include <prism.h>
#include <prism/internal/comments.h>
#include <prism/internal/parser.h>
#include <stdlib.h>
#include <string.h>

hb_string_T pm_error_level_to_string(pm_error_level_t level) {
  switch (level) {
    case PM_ERROR_LEVEL_SYNTAX: return hb_string("syntax");
    case PM_ERROR_LEVEL_ARGUMENT: return hb_string("argument");
    case PM_ERROR_LEVEL_LOAD: return hb_string("load");
  }
}

RUBY_PARSE_ERROR_T* ruby_parse_error_from_prism_error(
  const pm_diagnostic_t* error,
  const AST_NODE_T* node,
  const char* source,
  pm_parser_t* parser,
  hb_allocator_T* allocator
) {
  (void) parser;

  pm_location_t location = pm_diagnostic_location(error);

  position_T start = position_from_source_with_offset(source, location.start);
  position_T end = position_from_source_with_offset(source, herb_prism_location_end(location));

  return ruby_parse_error_init(
    hb_string(pm_diagnostic_message(error)),
    hb_string(pm_diagnostic_type(error)),
    pm_error_level_to_string(pm_diagnostic_error_level(error)),
    start,
    end,
    allocator
  );
}

RUBY_PARSE_ERROR_T* ruby_parse_error_from_prism_error_with_positions(
  const pm_diagnostic_t* error,
  position_T start,
  position_T end,
  hb_allocator_T* allocator
) {
  return ruby_parse_error_init(
    hb_string(pm_diagnostic_message(error)),
    hb_string(pm_diagnostic_type(error)),
    pm_error_level_to_string(pm_diagnostic_error_level(error)),
    start,
    end,
    allocator
  );
}

typedef struct {
  pm_location_t then_keyword_loc;
  bool found;
} then_keyword_search_context_T;

static pm_visit_result_t search_then_keyword_location(const pm_node_t* node, void* data) {
  then_keyword_search_context_T* context = (then_keyword_search_context_T*) data;

  if (context->found) { return PM_VISIT_SKIP; }

  switch (node->type) {
    case PM_IF_NODE: {
      const pm_if_node_t* if_node = (const pm_if_node_t*) node;

      if (!herb_prism_location_present(if_node->if_keyword_loc)) { break; }

      if (herb_prism_location_present(if_node->then_keyword_loc)) {
        context->then_keyword_loc = if_node->then_keyword_loc;
        context->found = true;
        return PM_VISIT_SKIP;
      }
      break;
    }

    case PM_UNLESS_NODE: {
      const pm_unless_node_t* unless_node = (const pm_unless_node_t*) node;
      if (herb_prism_location_present(unless_node->then_keyword_loc)) {
        context->then_keyword_loc = unless_node->then_keyword_loc;
        context->found = true;
        return PM_VISIT_SKIP;
      }
      break;
    }

    case PM_WHEN_NODE: {
      const pm_when_node_t* when_node = (const pm_when_node_t*) node;
      if (herb_prism_location_present(when_node->then_keyword_loc)) {
        context->then_keyword_loc = when_node->then_keyword_loc;
        context->found = true;
        return PM_VISIT_SKIP;
      }
      break;
    }

    case PM_IN_NODE: {
      const pm_in_node_t* in_node = (const pm_in_node_t*) node;
      if (herb_prism_location_present(in_node->then_keyword_loc)) {
        context->then_keyword_loc = in_node->then_keyword_loc;
        context->found = true;
        return PM_VISIT_SKIP;
      }
      break;
    }

    default: break;
  }

  pm_visit_child_nodes(node, search_then_keyword_location, context);

  return PM_VISIT_SKIP;
}

location_T* get_then_keyword_location(analyzed_ruby_T* analyzed, const char* source, hb_allocator_T* allocator) {
  if (analyzed == NULL || analyzed->root == NULL || source == NULL) { return NULL; }

  then_keyword_search_context_T context = { .then_keyword_loc = { .start = 0, .length = 0 }, .found = false };

  pm_visit_child_nodes(analyzed->root, search_then_keyword_location, &context);

  if (!context.found) { return NULL; }

  position_T start_position = position_from_source_with_offset(source, context.then_keyword_loc.start);
  position_T end_position = position_from_source_with_offset(source, herb_prism_location_end(context.then_keyword_loc));

  return location_create(start_position, end_position, allocator);
}

static location_T* parse_wrapped_and_find_then_keyword(
  hb_buffer_T* buffer,
  const char* source,
  size_t source_length,
  size_t prefix_length,
  size_t adjustment_threshold,
  size_t adjustment_amount,
  hb_allocator_T* allocator
) {
  pm_arena_t* arena = pm_arena_new();
  pm_parser_t* parser = pm_parser_new(arena, (const uint8_t*) hb_buffer_value(buffer), hb_buffer_length(buffer), NULL);
  pm_node_t* root = pm_parse(parser);

  if (root == NULL) {
    pm_parser_free(parser);
    pm_arena_free(arena);

    return NULL;
  }

  then_keyword_search_context_T context = { .then_keyword_loc = { .start = 0, .length = 0 }, .found = false };

  pm_visit_child_nodes(root, search_then_keyword_location, &context);

  location_T* location = NULL;

  if (context.found) {
    size_t start_offset = context.then_keyword_loc.start;
    size_t end_offset = herb_prism_location_end(context.then_keyword_loc);

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

        location = location_create(start_position, end_position, allocator);
      }
    }
  }

  pm_parser_free(parser);
  pm_arena_free(arena);

  return location;
}

location_T* get_then_keyword_location_wrapped(const char* source, bool is_in_clause, hb_allocator_T* allocator) {
  if (source == NULL) { return NULL; }

  size_t source_length = strlen(source);

  hb_buffer_T buffer;

  if (!hb_buffer_init(&buffer, source_length + 16, allocator)) { return NULL; }

  hb_buffer_append(&buffer, "case x\n");
  size_t prefix_length = hb_buffer_length(&buffer);
  hb_buffer_append(&buffer, source);
  hb_buffer_append(&buffer, "\nend");

  location_T* location =
    parse_wrapped_and_find_then_keyword(&buffer, source, source_length, prefix_length, SIZE_MAX, 0, allocator);

  hb_buffer_free(&buffer);

  return location;
}

location_T* get_then_keyword_location_elsif_wrapped(const char* source, hb_allocator_T* allocator) {
  if (source == NULL) { return NULL; }

  const char* elsif_position = strstr(source, "elsif");

  if (elsif_position == NULL) { return NULL; }

  size_t source_length = strlen(source);
  size_t elsif_offset = (size_t) (elsif_position - source);
  size_t replacement_diff = strlen("elsif") - strlen("if");

  hb_buffer_T buffer;

  if (!hb_buffer_init(&buffer, source_length + 8, allocator)) { return NULL; }

  hb_buffer_append_with_length(&buffer, source, elsif_offset);
  hb_buffer_append(&buffer, "if");
  size_t if_end_offset = hb_buffer_length(&buffer);
  hb_buffer_append(&buffer, source + elsif_offset + strlen("elsif"));
  hb_buffer_append(&buffer, "\nend");

  location_T* location =
    parse_wrapped_and_find_then_keyword(&buffer, source, source_length, 0, if_end_offset, replacement_diff, allocator);

  hb_buffer_free(&buffer);

  return location;
}

static size_t newline_index_for_offset(const pm_line_offset_list_t* newlines, size_t offset) {
  size_t low = 0;
  size_t high = newlines->size;

  while (low < high) {
    size_t middle = low + (high - low) / 2;

    if (newlines->offsets[middle] <= offset) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low > 0 ? low - 1 : 0;
}

void herb_prism_node_serialize(herb_prism_node_T prism_node, pm_buffer_t* buffer) {
  if (!prism_node.node || !prism_node.parser) { return; }

  pm_parser_t* parser = prism_node.parser;

  if (prism_node.source_end == 0 || parser->line_offsets.size == 0) {
    pm_serialize(parser, prism_node.node, buffer);
    return;
  }

  const pm_line_offset_list_t* newlines = &parser->line_offsets;
  size_t first_line = newline_index_for_offset(newlines, prism_node.source_start);
  size_t last_line = newline_index_for_offset(newlines, prism_node.source_end);
  size_t line_count = last_line - first_line + 1;

  if (last_line + 1 < newlines->size) { line_count++; }

  pm_parser_t view = *parser;

  view.line_offsets.offsets = newlines->offsets + first_line;
  view.line_offsets.size = line_count;
  view.line_offsets.capacity = line_count;
  view.start_line = parser->start_line + (int32_t) first_line;

  memset(&view.magic_comment_list, 0, sizeof(pm_list_t));
  memset(&view.error_list, 0, sizeof(pm_list_t));
  memset(&view.warning_list, 0, sizeof(pm_list_t));
  memset(&view.comment_list, 0, sizeof(pm_list_t));
  memset(&view.comment_attachments, 0, sizeof(view.comment_attachments));

  size_t comment_count = 0;

  for (pm_list_node_t* entry = parser->comment_list.head; entry; entry = entry->next) {
    pm_comment_t* comment = (pm_comment_t*) entry;
    size_t start = comment->location.start;

    if (start >= prism_node.source_start && start < prism_node.source_end) { comment_count++; }
  }

  pm_comment_t* comments = NULL;

  if (comment_count > 0) {
    comments = malloc(comment_count * sizeof(pm_comment_t));

    if (!comments) {
      pm_serialize(parser, prism_node.node, buffer);
      return;
    }

    size_t index = 0;

    for (pm_list_node_t* entry = parser->comment_list.head; entry; entry = entry->next) {
      pm_comment_t* comment = (pm_comment_t*) entry;
      size_t start = comment->location.start;

      if (start < prism_node.source_start || start >= prism_node.source_end) { continue; }

      comments[index] = *comment;
      comments[index].node.next = NULL;

      if (index > 0) { comments[index - 1].node.next = &comments[index].node; }

      index++;
    }

    view.comment_list.size = comment_count;
    view.comment_list.head = &comments[0].node;
    view.comment_list.tail = &comments[comment_count - 1].node;
  }

  pm_serialize(&view, prism_node.node, buffer);

  free(comments);
}
