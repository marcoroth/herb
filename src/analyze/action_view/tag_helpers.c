#include "../../include/analyze/action_view/tag_helpers.h"
#include "../../include/analyze/action_view/attribute_extraction_helpers.h"
#include "../../include/analyze/action_view/tag_helper_handler.h"
#include "../../include/analyze/action_view/tag_helper_node_builders.h"
#include "../../include/analyze/analyze.h"
#include "../../include/ast_nodes.h"
#include "../../include/html_util.h"
#include "../../include/parser_helpers.h"
#include "../../include/position.h"
#include "../../include/util/hb_allocator.h"
#include "../../include/util/hb_array.h"
#include "../../include/util/hb_string.h"
#include "../../include/visitor.h"

#include <prism.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

extern bool detect_link_to(pm_call_node_t*, pm_parser_t*);
extern bool is_route_helper_node(pm_node_t*, pm_parser_t*);
extern char* wrap_in_url_for(const char*, size_t, hb_allocator_T*);
extern char* extract_link_to_href(pm_call_node_t*, pm_parser_t*, hb_allocator_T*);
extern bool detect_turbo_frame_tag(pm_call_node_t*, pm_parser_t*);
extern char* extract_turbo_frame_tag_id(pm_call_node_t*, pm_parser_t*, hb_allocator_T*);
extern bool detect_javascript_include_tag(pm_call_node_t*, pm_parser_t*);
extern char* extract_javascript_include_tag_src(pm_call_node_t*, pm_parser_t*, hb_allocator_T*);
extern char* wrap_in_javascript_path(const char*, size_t, hb_allocator_T*);
extern bool javascript_include_tag_source_is_url(const char*, size_t);

typedef struct {
  pm_parser_t parser;
  pm_node_t* root;
  const uint8_t* prism_source;
  char* content_string;
  tag_helper_info_T* info;
  const tag_helper_handler_T* matched_handler;
  const char* original_source;
  size_t erb_content_offset;
} tag_helper_parse_context_T;

static tag_helper_parse_context_T* parse_tag_helper_content(
  const char* content_string,
  const char* original_source,
  size_t erb_content_offset,
  hb_allocator_T* allocator
) {
  if (!content_string) { return NULL; }

  tag_helper_parse_context_T* parse_context = hb_allocator_alloc(allocator, sizeof(tag_helper_parse_context_T));
  if (!parse_context) { return NULL; }

  parse_context->content_string = hb_allocator_strdup(allocator, content_string);
  parse_context->prism_source = (const uint8_t*) parse_context->content_string;
  parse_context->original_source = original_source;
  parse_context->erb_content_offset = erb_content_offset;

  pm_parser_init(&parse_context->parser, parse_context->prism_source, strlen(parse_context->content_string), NULL);
  parse_context->root = pm_parse(&parse_context->parser);

  if (!parse_context->root) {
    pm_parser_free(&parse_context->parser);
    hb_allocator_dealloc(allocator, parse_context->content_string);
    hb_allocator_dealloc(allocator, parse_context);
    return NULL;
  }

  parse_context->info = tag_helper_info_init(allocator);
  tag_helper_search_data_T search = { .tag_helper_node = NULL,
                                      .source = parse_context->prism_source,
                                      .parser = &parse_context->parser,
                                      .info = parse_context->info,
                                      .found = false };
  pm_visit_node(parse_context->root, search_tag_helper_node, &search);

  if (!search.found) {
    tag_helper_info_free(&parse_context->info);
    pm_node_destroy(&parse_context->parser, parse_context->root);
    pm_parser_free(&parse_context->parser);
    hb_allocator_dealloc(allocator, parse_context->content_string);
    hb_allocator_dealloc(allocator, parse_context);
    return NULL;
  }

  parse_context->matched_handler = search.matched_handler;
  return parse_context;
}

static void free_tag_helper_parse_context(tag_helper_parse_context_T* parse_context) {
  if (!parse_context) { return; }

  hb_allocator_T* allocator = parse_context->info ? parse_context->info->allocator : NULL;

  tag_helper_info_free(&parse_context->info);
  pm_node_destroy(&parse_context->parser, parse_context->root);
  pm_parser_free(&parse_context->parser);

  if (allocator) {
    hb_allocator_dealloc(allocator, parse_context->content_string);
    hb_allocator_dealloc(allocator, parse_context);
  }
}

bool search_tag_helper_node(const pm_node_t* node, void* data) {
  tag_helper_search_data_T* search_data = (tag_helper_search_data_T*) data;

  if (node->type == PM_CALL_NODE) {
    pm_call_node_t* call_node = (pm_call_node_t*) node;
    tag_helper_handler_T* handlers = get_tag_helper_handlers();
    size_t handlers_count = get_tag_helper_handlers_count();

    for (size_t i = 0; i < handlers_count; i++) {
      if (handlers[i].detect(call_node, search_data->parser)) {
        search_data->tag_helper_node = node;
        search_data->matched_handler = &handlers[i];
        search_data->found = true;

        if (search_data->info) {
          search_data->info->call_node = call_node;
          search_data->info->tag_name =
            handlers[i].extract_tag_name(call_node, search_data->parser, search_data->info->allocator);
          search_data->info->content =
            handlers[i].extract_content(call_node, search_data->parser, search_data->info->allocator);
          search_data->info->has_block = handlers[i].supports_block();
        }

        return true;
      }
    }
  }

  pm_visit_child_nodes(node, search_tag_helper_node, search_data);

  return search_data->found;
}

position_T byte_offset_to_position(const char* source, size_t offset) {
  position_T position = { .line = 1, .column = 1 };

  if (!source) { return position; }

  for (size_t i = 0; i < offset && source[i] != '\0'; i++) {
    if (source[i] == '\n') {
      position.line++;
      position.column = 1;
    } else {
      position.column++;
    }
  }

  return position;
}

position_T prism_location_to_position_with_offset(
  const pm_location_t* pm_location,
  const char* original_source,
  size_t erb_content_offset,
  const uint8_t* erb_content_source
) {
  position_T default_position = { .line = 1, .column = 1 };

  if (!pm_location || !pm_location->start || !original_source || !erb_content_source) { return default_position; }

  size_t offset_in_erb = (size_t) (pm_location->start - erb_content_source);
  size_t total_offset = erb_content_offset + offset_in_erb;

  size_t source_length = strlen(original_source);
  if (total_offset > source_length) { return byte_offset_to_position(original_source, erb_content_offset); }

  return byte_offset_to_position(original_source, total_offset);
}

size_t calculate_byte_offset_from_position(const char* source, position_T position) {
  if (!source) { return 0; }

  size_t offset = 0;
  uint32_t line = 1;
  uint32_t column = 1;

  while (source[offset] != '\0') {
    if (line == position.line && column == position.column) { return offset; }

    if (source[offset] == '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }

    offset++;
  }

  return offset;
}

static void prism_node_location_to_positions(
  const pm_location_t* location,
  tag_helper_parse_context_T* parse_context,
  position_T* out_start,
  position_T* out_end
) {
  *out_start = prism_location_to_position_with_offset(
    location,
    parse_context->original_source,
    parse_context->erb_content_offset,
    parse_context->prism_source
  );

  pm_location_t end_location = { .start = location->end, .end = location->end };
  *out_end = prism_location_to_position_with_offset(
    &end_location,
    parse_context->original_source,
    parse_context->erb_content_offset,
    parse_context->prism_source
  );
}

static void calculate_tag_name_positions(
  tag_helper_parse_context_T* parse_context,
  position_T default_start,
  position_T default_end,
  position_T* out_start,
  position_T* out_end
) {
  *out_start = default_start;
  *out_end = default_end;

  if (parse_context->info->call_node && parse_context->info->call_node->message_loc.start) {
    prism_node_location_to_positions(&parse_context->info->call_node->message_loc, parse_context, out_start, out_end);
  }
}

static AST_NODE_T* transform_tag_helper_with_attributes(
  AST_ERB_CONTENT_NODE_T* erb_node,
  analyze_ruby_context_T* context,
  tag_helper_parse_context_T* parse_context
) {
  if (!erb_node || !context || !parse_context) { return NULL; }
  hb_allocator_T* allocator = context->allocator;
  const tag_helper_handler_T* handler = parse_context->matched_handler;

  char* tag_name = parse_context->info->tag_name ? hb_allocator_strdup(allocator, parse_context->info->tag_name) : NULL;

  position_T tag_name_start, tag_name_end;
  calculate_tag_name_positions(
    parse_context,
    erb_node->base.location.start,
    erb_node->base.location.end,
    &tag_name_start,
    &tag_name_end
  );

  hb_array_T* attributes = NULL;
  if (parse_context->info->call_node) {
    attributes = extract_html_attributes_from_call_node(
      parse_context->info->call_node,
      parse_context->prism_source,
      parse_context->original_source,
      parse_context->erb_content_offset,
      allocator
    );
  }

  char* helper_content = NULL;
  bool content_is_ruby_expression = false;

  if (parse_context->info->call_node && handler->extract_content) {
    helper_content = handler->extract_content(parse_context->info->call_node, &parse_context->parser, allocator);

    if (helper_content && parse_context->info->call_node->arguments) {
      if (strcmp(handler->name, "content_tag") == 0 && parse_context->info->call_node->arguments->arguments.size >= 2) {
        content_is_ruby_expression =
          (parse_context->info->call_node->arguments->arguments.nodes[1]->type != PM_STRING_NODE);
      } else if (parse_context->info->call_node->arguments->arguments.size >= 1) {
        content_is_ruby_expression =
          (parse_context->info->call_node->arguments->arguments.nodes[0]->type != PM_STRING_NODE);
      }
    }
  }

  if (detect_turbo_frame_tag(parse_context->info->call_node, &parse_context->parser)) {
    char* id_value = extract_turbo_frame_tag_id(parse_context->info->call_node, &parse_context->parser, allocator);

    if (id_value) {
      if (!attributes) { attributes = hb_array_init(4, allocator); }

      pm_node_t* first_argument = parse_context->info->call_node->arguments->arguments.nodes[0];
      position_T id_start, id_end;
      prism_node_location_to_positions(&first_argument->location, parse_context, &id_start, &id_end);
      bool id_is_ruby_expression = (first_argument->type != PM_STRING_NODE && first_argument->type != PM_SYMBOL_NODE);

      AST_HTML_ATTRIBUTE_NODE_T* id_attribute =
        id_is_ruby_expression ? create_html_attribute_with_ruby_literal("id", id_value, id_start, id_end, allocator)
                              : create_html_attribute_node("id", id_value, id_start, id_end, allocator);

      if (id_attribute) { attributes = prepend_attribute(attributes, (AST_NODE_T*) id_attribute, allocator); }

      hb_allocator_dealloc(allocator, id_value);
    }
  }

  if (detect_javascript_include_tag(parse_context->info->call_node, &parse_context->parser)
      && parse_context->info->call_node->arguments && parse_context->info->call_node->arguments->arguments.size >= 1) {
    char* source_value =
      extract_javascript_include_tag_src(parse_context->info->call_node, &parse_context->parser, allocator);

    if (source_value) {
      if (!attributes) { attributes = hb_array_init(4, allocator); }

      pm_node_t* first_argument = parse_context->info->call_node->arguments->arguments.nodes[0];
      position_T source_start, source_end;
      prism_node_location_to_positions(&first_argument->location, parse_context, &source_start, &source_end);
      bool source_is_string = (first_argument->type == PM_STRING_NODE);

      size_t source_length = strlen(source_value);
      bool is_url = javascript_include_tag_source_is_url(source_value, source_length);

      char* source_attribute_value = source_value;
      if (source_is_string && !is_url) {
        size_t quoted_length = source_length + 2;
        char* quoted_source = hb_allocator_alloc(allocator, quoted_length + 1);
        quoted_source[0] = '"';
        memcpy(quoted_source + 1, source_value, source_length);
        quoted_source[quoted_length - 1] = '"';
        quoted_source[quoted_length] = '\0';

        source_attribute_value = wrap_in_javascript_path(quoted_source, quoted_length, allocator);
        hb_allocator_dealloc(allocator, quoted_source);
      }

      AST_HTML_ATTRIBUTE_NODE_T* source_attribute =
        is_url
          ? create_html_attribute_node("src", source_attribute_value, source_start, source_end, allocator)
          : create_html_attribute_with_ruby_literal("src", source_attribute_value, source_start, source_end, allocator);

      if (source_attribute) { attributes = prepend_attribute(attributes, (AST_NODE_T*) source_attribute, allocator); }

      if (source_attribute_value != source_value) { hb_allocator_dealloc(allocator, source_attribute_value); }
      hb_allocator_dealloc(allocator, source_value);
    }
  }

  token_T* tag_name_token =
    tag_name ? create_synthetic_token(allocator, tag_name, TOKEN_IDENTIFIER, tag_name_start, tag_name_end) : NULL;

  hb_array_T* open_tag_children = attributes ? attributes : hb_array_init(0, allocator);

  AST_ERB_OPEN_TAG_NODE_T* open_tag_node = ast_erb_open_tag_node_init(
    erb_node->tag_opening,
    erb_node->content,
    erb_node->tag_closing,
    tag_name_token,
    open_tag_children,
    erb_node->base.location.start,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  hb_array_T* body = hb_array_init(1, allocator);
  bool is_void = tag_name && (strcmp(handler->name, "tag") == 0) && is_void_element(hb_string_from_c_string(tag_name));

  if (helper_content) {
    append_body_content_node(
      body,
      helper_content,
      content_is_ruby_expression,
      erb_node->base.location.start,
      erb_node->base.location.end,
      allocator
    );
    hb_allocator_dealloc(allocator, helper_content);
  }

  AST_NODE_T* close_tag = NULL;

  if (!is_void) {
    AST_HTML_VIRTUAL_CLOSE_TAG_NODE_T* virtual_close = ast_html_virtual_close_tag_node_init(
      tag_name_token,
      erb_node->base.location.end,
      erb_node->base.location.end,
      hb_array_init(0, allocator),
      allocator
    );
    close_tag = (AST_NODE_T*) virtual_close;
  }

  AST_HTML_ELEMENT_NODE_T* element = ast_html_element_node_init(
    (AST_NODE_T*) open_tag_node,
    tag_name_token,
    body,
    close_tag,
    is_void,
    handler->source,
    erb_node->base.location.start,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  hb_allocator_dealloc(allocator, tag_name);
  return (AST_NODE_T*) element;
}

static size_t count_javascript_include_tag_sources(pm_call_node_t* call_node) {
  if (!call_node || !call_node->arguments) { return 0; }

  size_t count = 0;
  pm_arguments_node_t* arguments = call_node->arguments;

  for (size_t i = 0; i < arguments->arguments.size; i++) {
    pm_node_t* arg = arguments->arguments.nodes[i];
    if (arg->type == PM_KEYWORD_HASH_NODE) { break; }
    count++;
  }

  return count;
}

static AST_NODE_T* create_javascript_include_tag_element(
  AST_ERB_CONTENT_NODE_T* erb_node,
  tag_helper_parse_context_T* parse_context,
  pm_node_t* source_argument,
  hb_array_T* shared_attributes,
  hb_allocator_T* allocator
) {
  position_T tag_name_start, tag_name_end;
  calculate_tag_name_positions(
    parse_context,
    erb_node->base.location.start,
    erb_node->base.location.end,
    &tag_name_start,
    &tag_name_end
  );

  token_T* tag_name_token = create_synthetic_token(allocator, "script", TOKEN_IDENTIFIER, tag_name_start, tag_name_end);

  char* source_value = NULL;
  bool source_is_string = (source_argument->type == PM_STRING_NODE);

  if (source_is_string) {
    pm_string_node_t* string_node = (pm_string_node_t*) source_argument;
    size_t length = pm_string_length(&string_node->unescaped);
    source_value = hb_allocator_strndup(allocator, (const char*) pm_string_source(&string_node->unescaped), length);
  } else {
    size_t source_length = source_argument->location.end - source_argument->location.start;
    source_value = hb_allocator_strndup(allocator, (const char*) source_argument->location.start, source_length);
  }

  position_T source_start, source_end;
  prism_node_location_to_positions(&source_argument->location, parse_context, &source_start, &source_end);

  size_t source_length = strlen(source_value);
  bool is_url = javascript_include_tag_source_is_url(source_value, source_length);

  char* source_attribute_value = source_value;
  if (source_is_string && !is_url) {
    size_t quoted_length = source_length + 2;
    char* quoted_source = hb_allocator_alloc(allocator, quoted_length + 1);
    quoted_source[0] = '"';
    memcpy(quoted_source + 1, source_value, source_length);
    quoted_source[quoted_length - 1] = '"';
    quoted_source[quoted_length] = '\0';

    source_attribute_value = wrap_in_javascript_path(quoted_source, quoted_length, allocator);
    hb_allocator_dealloc(allocator, quoted_source);
  }

  hb_array_T* attributes = hb_array_init(hb_array_size(shared_attributes) + 1, allocator);

  AST_HTML_ATTRIBUTE_NODE_T* source_attribute =
    is_url
      ? create_html_attribute_node("src", source_attribute_value, source_start, source_end, allocator)
      : create_html_attribute_with_ruby_literal("src", source_attribute_value, source_start, source_end, allocator);
  if (source_attribute) { hb_array_append(attributes, source_attribute); }

  for (size_t i = 0; i < hb_array_size(shared_attributes); i++) {
    hb_array_append(attributes, hb_array_get(shared_attributes, i));
  }

  if (source_attribute_value != source_value) { hb_allocator_dealloc(allocator, source_attribute_value); }
  hb_allocator_dealloc(allocator, source_value);

  AST_ERB_OPEN_TAG_NODE_T* open_tag_node = ast_erb_open_tag_node_init(
    erb_node->tag_opening,
    erb_node->content,
    erb_node->tag_closing,
    tag_name_token,
    attributes,
    erb_node->base.location.start,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  AST_HTML_VIRTUAL_CLOSE_TAG_NODE_T* virtual_close = ast_html_virtual_close_tag_node_init(
    tag_name_token,
    erb_node->base.location.end,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  return (AST_NODE_T*) ast_html_element_node_init(
    (AST_NODE_T*) open_tag_node,
    tag_name_token,
    hb_array_init(0, allocator),
    (AST_NODE_T*) virtual_close,
    false,
    parse_context->matched_handler->source,
    erb_node->base.location.start,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );
}

static hb_array_T* transform_javascript_include_tag_multi_source(
  AST_ERB_CONTENT_NODE_T* erb_node,
  analyze_ruby_context_T* context,
  tag_helper_parse_context_T* parse_context
) {
  hb_allocator_T* allocator = context->allocator;
  pm_call_node_t* call_node = parse_context->info->call_node;
  size_t source_count = count_javascript_include_tag_sources(call_node);

  if (source_count == 0) { return NULL; }

  hb_array_T* shared_attributes = extract_html_attributes_from_call_node(
    call_node,
    parse_context->prism_source,
    parse_context->original_source,
    parse_context->erb_content_offset,
    allocator
  );
  if (!shared_attributes) { shared_attributes = hb_array_init(0, allocator); }

  hb_array_T* elements = hb_array_init(source_count * 2, allocator);

  for (size_t i = 0; i < source_count; i++) {
    pm_node_t* source_arg = call_node->arguments->arguments.nodes[i];
    AST_NODE_T* element =
      create_javascript_include_tag_element(erb_node, parse_context, source_arg, shared_attributes, allocator);

    if (element) {
      if (hb_array_size(elements) > 0) {
        position_T position = erb_node->base.location.start;
        AST_HTML_TEXT_NODE_T* newline = ast_html_text_node_init(
          hb_string_from_c_string("\n"),
          position,
          position,
          hb_array_init(0, allocator),
          allocator
        );
        if (newline) { hb_array_append(elements, (AST_NODE_T*) newline); }
      }

      hb_array_append(elements, element);
    }
  }

  return elements;
}

static AST_NODE_T* transform_erb_block_to_tag_helper(
  AST_ERB_BLOCK_NODE_T* block_node,
  analyze_ruby_context_T* context,
  tag_helper_parse_context_T* parse_context
) {
  if (!block_node || !context || !parse_context) { return NULL; }
  hb_allocator_T* allocator = context->allocator;

  char* tag_name = parse_context->info->tag_name ? hb_allocator_strdup(allocator, parse_context->info->tag_name) : NULL;

  position_T tag_name_start, tag_name_end;
  calculate_tag_name_positions(
    parse_context,
    block_node->base.location.start,
    block_node->base.location.end,
    &tag_name_start,
    &tag_name_end
  );

  hb_array_T* attributes = NULL;
  if (parse_context->info->call_node) {
    attributes = extract_html_attributes_from_call_node(
      parse_context->info->call_node,
      parse_context->prism_source,
      parse_context->original_source,
      parse_context->erb_content_offset,
      allocator
    );
  }

  if (detect_link_to(parse_context->info->call_node, &parse_context->parser)
      && parse_context->info->call_node->arguments && parse_context->info->call_node->arguments->arguments.size >= 1) {
    pm_node_t* first_argument = parse_context->info->call_node->arguments->arguments.nodes[0];
    size_t source_length = first_argument->location.end - first_argument->location.start;
    char* href = NULL;

    if (first_argument->type != PM_STRING_NODE && !is_route_helper_node(first_argument, &parse_context->parser)) {
      href = wrap_in_url_for((const char*) first_argument->location.start, source_length, allocator);
    } else {
      href = hb_allocator_strndup(allocator, (const char*) first_argument->location.start, source_length);
    }

    if (href) {
      if (!attributes) { attributes = hb_array_init(4, allocator); }

      position_T href_start, href_end;
      prism_node_location_to_positions(&first_argument->location, parse_context, &href_start, &href_end);
      bool href_is_ruby_expression = (first_argument->type != PM_STRING_NODE);

      if (first_argument->type == PM_STRING_NODE) {
        hb_allocator_dealloc(allocator, href);
        pm_string_node_t* string_node = (pm_string_node_t*) first_argument;
        size_t length = pm_string_length(&string_node->unescaped);
        href = hb_allocator_strndup(allocator, (const char*) pm_string_source(&string_node->unescaped), length);
      }

      AST_HTML_ATTRIBUTE_NODE_T* href_attribute =
        create_href_attribute(href, href_is_ruby_expression, href_start, href_end, allocator);

      if (href_attribute) { attributes = prepend_attribute(attributes, (AST_NODE_T*) href_attribute, allocator); }

      hb_allocator_dealloc(allocator, href);
    }
  }

  if (detect_turbo_frame_tag(parse_context->info->call_node, &parse_context->parser)) {
    char* id_value = extract_turbo_frame_tag_id(parse_context->info->call_node, &parse_context->parser, allocator);

    if (id_value) {
      if (!attributes) { attributes = hb_array_init(4, allocator); }

      pm_node_t* first_argument = parse_context->info->call_node->arguments->arguments.nodes[0];
      position_T id_start, id_end;
      prism_node_location_to_positions(&first_argument->location, parse_context, &id_start, &id_end);
      bool id_is_ruby_expression = (first_argument->type != PM_STRING_NODE && first_argument->type != PM_SYMBOL_NODE);

      AST_HTML_ATTRIBUTE_NODE_T* id_attribute =
        id_is_ruby_expression ? create_html_attribute_with_ruby_literal("id", id_value, id_start, id_end, allocator)
                              : create_html_attribute_node("id", id_value, id_start, id_end, allocator);

      if (id_attribute) { attributes = prepend_attribute(attributes, (AST_NODE_T*) id_attribute, allocator); }

      hb_allocator_dealloc(allocator, id_value);
    }
  }

  token_T* tag_name_token =
    tag_name ? create_synthetic_token(allocator, tag_name, TOKEN_IDENTIFIER, tag_name_start, tag_name_end) : NULL;

  hb_array_T* open_tag_children = attributes ? attributes : hb_array_init(0, allocator);

  AST_ERB_OPEN_TAG_NODE_T* open_tag_node = ast_erb_open_tag_node_init(
    block_node->tag_opening,
    block_node->content,
    block_node->tag_closing,
    tag_name_token,
    open_tag_children,
    block_node->tag_opening->location.start,
    block_node->tag_closing->location.end,
    hb_array_init(0, allocator),
    allocator
  );

  hb_array_T* body = block_node->body ? block_node->body : hb_array_init(0, allocator);
  AST_NODE_T* close_tag = (AST_NODE_T*) block_node->end_node;

  if (tag_name && parser_is_foreign_content_tag(hb_string_from_c_string(tag_name)) && context->source
      && block_node->body && hb_array_size(block_node->body) > 0) {
    size_t start_offset = block_node->tag_closing->range.to;
    size_t end_offset = block_node->end_node->tag_opening->range.from;

    if (end_offset > start_offset) {
      position_T body_start = block_node->tag_closing->location.end;
      position_T body_end = block_node->end_node->tag_opening->location.start;

      size_t content_length = end_offset - start_offset;
      char* raw_copy = hb_allocator_strndup(allocator, context->source + start_offset, content_length);
      hb_string_T raw_content = { .data = raw_copy, .length = content_length };

      AST_LITERAL_NODE_T* literal_node =
        ast_literal_node_init(raw_content, body_start, body_end, hb_array_init(0, allocator), allocator);

      body = hb_array_init(1, allocator);
      hb_array_append(body, literal_node);
    }
  }

  AST_HTML_ELEMENT_NODE_T* element = ast_html_element_node_init(
    (AST_NODE_T*) open_tag_node,
    tag_name_token,
    body,
    close_tag,
    false,
    parse_context->matched_handler->source,
    block_node->base.location.start,
    block_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  hb_allocator_dealloc(allocator, tag_name);
  return (AST_NODE_T*) element;
}

static AST_NODE_T* transform_link_to_helper(
  AST_ERB_CONTENT_NODE_T* erb_node,
  analyze_ruby_context_T* context,
  tag_helper_parse_context_T* parse_context
) {
  if (!erb_node || !context || !parse_context) { return NULL; }
  hb_allocator_T* allocator = context->allocator;
  tag_helper_info_T* info = parse_context->info;

  char* href = extract_link_to_href(info->call_node, &parse_context->parser, allocator);

  hb_array_T* attributes = NULL;
  pm_arguments_node_t* link_arguments = info->call_node->arguments;
  bool keyword_hash_is_url = link_arguments && link_arguments->arguments.size == 2
                          && link_arguments->arguments.nodes[1]->type == PM_KEYWORD_HASH_NODE;

  if (!keyword_hash_is_url) {
    attributes = extract_html_attributes_from_call_node(
      info->call_node,
      parse_context->prism_source,
      parse_context->original_source,
      parse_context->erb_content_offset,
      allocator
    );
  }

  if (!attributes) { attributes = hb_array_init(4, allocator); }

  // `method:` implies `rel="nofollow"`
  bool has_data_method = false;
  hb_string_T data_method_string = hb_string("data-method");

  for (size_t i = 0; i < hb_array_size(attributes); i++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(attributes, i);

    if (node->type != AST_HTML_ATTRIBUTE_NODE) { continue; }

    AST_HTML_ATTRIBUTE_NODE_T* attribute = (AST_HTML_ATTRIBUTE_NODE_T*) node;

    if (!attribute->name || !attribute->name->children || !hb_array_size(attribute->name->children)) { continue; }

    AST_LITERAL_NODE_T* literal = (AST_LITERAL_NODE_T*) hb_array_get(attribute->name->children, 0);

    if (hb_string_equals(literal->content, data_method_string)) {
      has_data_method = true;
      break;
    }
  }

  if (has_data_method) {
    position_T rel_position = erb_node->base.location.start;

    AST_HTML_ATTRIBUTE_NODE_T* rel_attribute =
      create_html_attribute_node("rel", "nofollow", rel_position, rel_position, allocator);

    if (rel_attribute) { hb_array_append(attributes, rel_attribute); }
  }

  char* href_for_body = NULL;
  bool href_for_body_is_ruby_expression = false;

  if (href) {
    position_T href_start = erb_node->content->location.start;
    position_T href_end = href_start;
    bool href_is_ruby_expression = true;

    if (info->call_node && info->call_node->arguments) {
      pm_arguments_node_t* arguments = info->call_node->arguments;
      pm_node_t* href_argument = NULL;

      if (arguments->arguments.size >= 2) {
        href_argument = arguments->arguments.nodes[1];
        href_is_ruby_expression = (href_argument->type != PM_STRING_NODE);
      } else if (arguments->arguments.size == 1) {
        href_argument = arguments->arguments.nodes[0];
        href_is_ruby_expression = true;
      }

      if (href_argument) {
        prism_node_location_to_positions(&href_argument->location, parse_context, &href_start, &href_end);
      }
    }

    AST_HTML_ATTRIBUTE_NODE_T* href_attribute =
      create_href_attribute(href, href_is_ruby_expression, href_start, href_end, allocator);

    if (href_attribute) { attributes = prepend_attribute(attributes, (AST_NODE_T*) href_attribute, allocator); }
    if (!info->content) {
      href_for_body = hb_allocator_strdup(allocator, href);
      href_for_body_is_ruby_expression = href_is_ruby_expression;
    }

    hb_allocator_dealloc(allocator, href);
  }

  position_T tag_name_start, tag_name_end;
  calculate_tag_name_positions(
    parse_context,
    erb_node->base.location.start,
    erb_node->base.location.end,
    &tag_name_start,
    &tag_name_end
  );

  token_T* tag_name_token = create_synthetic_token(allocator, "a", TOKEN_IDENTIFIER, tag_name_start, tag_name_end);

  AST_ERB_OPEN_TAG_NODE_T* open_tag_node = ast_erb_open_tag_node_init(
    erb_node->tag_opening,
    erb_node->content,
    erb_node->tag_closing,
    tag_name_token,
    attributes,
    erb_node->base.location.start,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  hb_array_T* body = hb_array_init(1, allocator);

  if (info->content) {
    bool content_is_ruby_expression = false;

    if (info->call_node && info->call_node->arguments && info->call_node->arguments->arguments.size >= 1) {
      pm_node_t* first_argument = info->call_node->arguments->arguments.nodes[0];
      content_is_ruby_expression = (first_argument->type != PM_STRING_NODE);
    }

    append_body_content_node(
      body,
      info->content,
      content_is_ruby_expression,
      erb_node->base.location.start,
      erb_node->base.location.end,
      allocator
    );
  } else if (href_for_body) {
    append_body_content_node(
      body,
      href_for_body,
      href_for_body_is_ruby_expression,
      erb_node->base.location.start,
      erb_node->base.location.end,
      allocator
    );

    hb_allocator_dealloc(allocator, href_for_body);
  }

  AST_HTML_VIRTUAL_CLOSE_TAG_NODE_T* virtual_close = ast_html_virtual_close_tag_node_init(
    tag_name_token,
    erb_node->base.location.end,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  AST_HTML_ELEMENT_NODE_T* element = ast_html_element_node_init(
    (AST_NODE_T*) open_tag_node,
    tag_name_token,
    body,
    (AST_NODE_T*) virtual_close,
    false,
    parse_context->matched_handler->source,
    erb_node->base.location.start,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  return (AST_NODE_T*) element;
}

void transform_tag_helper_blocks(const AST_NODE_T* node, analyze_ruby_context_T* context) {
  if (!node || !context) { return; }

  hb_array_T* array = NULL;

  switch (node->type) {
    case AST_DOCUMENT_NODE: array = ((AST_DOCUMENT_NODE_T*) node)->children; break;
    case AST_HTML_ELEMENT_NODE: array = ((AST_HTML_ELEMENT_NODE_T*) node)->body; break;
    case AST_HTML_OPEN_TAG_NODE: array = ((AST_HTML_OPEN_TAG_NODE_T*) node)->children; break;
    case AST_HTML_ATTRIBUTE_VALUE_NODE: array = ((AST_HTML_ATTRIBUTE_VALUE_NODE_T*) node)->children; break;
    case AST_ERB_BLOCK_NODE: array = ((AST_ERB_BLOCK_NODE_T*) node)->body; break;
    default: return;
  }

  if (!array) { return; }

  for (size_t i = 0; i < hb_array_size(array); i++) {
    AST_NODE_T* child = hb_array_get(array, i);
    if (!child) { continue; }

    AST_NODE_T* replacement = NULL;

    if (child->type == AST_ERB_BLOCK_NODE) {
      AST_ERB_BLOCK_NODE_T* block_node = (AST_ERB_BLOCK_NODE_T*) child;
      token_T* block_content = block_node->content;

      if (block_content && !hb_string_is_empty(block_content->value)) {
        char* block_string = hb_string_to_c_string_using_malloc(block_content->value);
        size_t erb_content_offset = 0;

        if (context->source) {
          erb_content_offset = calculate_byte_offset_from_position(context->source, block_content->location.start);
        }

        tag_helper_parse_context_T* parse_context =
          parse_tag_helper_content(block_string, context->source, erb_content_offset, context->allocator);

        if (parse_context) {
          replacement = transform_erb_block_to_tag_helper(block_node, context, parse_context);
          free_tag_helper_parse_context(parse_context);
        }

        free(block_string);
      }
    } else if (child->type == AST_ERB_CONTENT_NODE) {
      AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) child;
      token_T* tag_opening = erb_node->tag_opening;

      if (tag_opening && !hb_string_is_empty(tag_opening->value)) {
        const char* opening_string = tag_opening->value.data;

        if (opening_string && strstr(opening_string, "#") != NULL) { continue; }
      }

      token_T* erb_content = erb_node->content;

      if (erb_content && !hb_string_is_empty(erb_content->value)) {
        char* erb_string = hb_string_to_c_string_using_malloc(erb_content->value);
        size_t erb_content_offset = 0;

        if (context->source) {
          erb_content_offset = calculate_byte_offset_from_position(context->source, erb_content->location.start);
        }

        tag_helper_parse_context_T* parse_context =
          parse_tag_helper_content(erb_string, context->source, erb_content_offset, context->allocator);

        if (parse_context) {
          if (strcmp(parse_context->matched_handler->name, "javascript_include_tag") == 0
              && parse_context->info->call_node
              && count_javascript_include_tag_sources(parse_context->info->call_node) > 1) {
            hb_array_T* multi = transform_javascript_include_tag_multi_source(erb_node, context, parse_context);

            if (multi && hb_array_size(multi) > 0) {
              size_t old_size = hb_array_size(array);
              size_t multi_size = hb_array_size(multi);
              hb_array_T* new_array = hb_array_init(old_size - 1 + multi_size, context->allocator);

              for (size_t j = 0; j < old_size; j++) {
                if (j == i) {
                  for (size_t k = 0; k < multi_size; k++) {
                    hb_array_append(new_array, hb_array_get(multi, k));
                  }
                } else {
                  hb_array_append(new_array, hb_array_get(array, j));
                }
              }

              array->items = new_array->items;
              array->size = new_array->size;
              array->capacity = new_array->capacity;

              i += multi_size - 1;
            }
          } else if (strcmp(parse_context->matched_handler->name, "link_to") == 0) {
            replacement = transform_link_to_helper(erb_node, context, parse_context);
          } else {
            replacement = transform_tag_helper_with_attributes(erb_node, context, parse_context);
          }

          free_tag_helper_parse_context(parse_context);
        }

        free(erb_string);
      }
    }

    if (replacement) { hb_array_set(array, i, replacement); }
  }
}

bool transform_tag_helper_nodes(const AST_NODE_T* node, void* data) {
  analyze_ruby_context_T* context = (analyze_ruby_context_T*) data;

  transform_tag_helper_blocks(node, context);

  herb_visit_child_nodes(node, transform_tag_helper_nodes, data);

  return false;
}
